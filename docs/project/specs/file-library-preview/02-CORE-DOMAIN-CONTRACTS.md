# W0-C — Core Domain Contracts

## 1. Identity vocabulary

Do not introduce a generic `FileIdentity` that collides with existing filesystem-safety identity types.

Workspace identity uses `EntryRef`:

```ts
type EntryRef = ManagedEntryRef | EphemeralEntryRef;

interface ManagedEntryRef {
  kind: "managed";
  fileId: string; // existing managed File Library ID
}

interface EphemeralEntryRef {
  kind: "ephemeral";
  browseSessionId: string;
  entryId: string; // opaque, session scoped
}
```

Three distinct concepts remain separate:

- `EntryRef` — which workspace entry Zen is referring to.
- `PhysicalPath` — where the object is currently resolved.
- Physical identity evidence — whether the current object is still the expected physical object; existing filesystem-safety authority owns this.

An `EntryRef` never becomes a substitute for backend revalidation at a byte-read or mutation boundary.

## 2. Location

`Location` is a domain projection, not a new durable database authority.

Managed locations project from existing scan roots. Ephemeral locations exist only inside Browse sessions.

```ts
type LocationRef =
  | { kind: "managed"; scanRootId: string }
  | { kind: "ephemeral"; browseSessionId: string; locationId: string };
```

Suggested descriptor:

```ts
interface LocationDescriptor {
  ref: LocationRef;
  displayName: string;
  kind: "local" | "external" | "network" | "cloud_provider" | "unknown";
  availability: LocationAvailability;
  freshness: LocationFreshness;
  capabilities: LocationCapabilities;
}
```

**Materialization/content availability is not a Location-level fact.** A provider-backed location may simultaneously contain local, metadata-only, downloading and remote-placeholder entries.

## 3. Availability and freshness

Availability answers whether the location can be accessed now:

- available
- offline
- disconnected
- permission_denied
- authentication_required
- not_found
- unknown

Freshness answers whether managed/indexed facts are current:

- current
- stale
- reconciling
- unknown
- not_applicable

An external drive can therefore be `available + reconciling`; Browse may work immediately while managed query-derived facts update in the background.

## 4. Entry content/materialization state

Content/materialization state is an **entry/source-level projection**, not byte-read authorization:

- local
- boundary_readable
- metadata_only
- remote_placeholder
- hydrating
- unavailable
- unknown

`boundary_readable` means only that a recent bounded platform proof exists. It does not become a durable claim that the source is fully local or permanently readable.

Policy v1:

- `never_implicit`
- `user_initiated_only`

There is no v1 auto-download policy.

PR #63 rule: generic File Provider path/routing information is not provider identity. Runtime capability and byte-read eligibility must fail closed where native/provider evidence is insufficient.

## 5. ContentReadEligibility

Materialization/content state and byte-read eligibility are deliberately separate.

A cross-platform read-eligibility projection must distinguish at least:

- eligible
- materialization_required
- permission_required
- source_unavailable
- source_not_supported
- identity_changed
- availability_unknown

The existing platform/content byte-read authority remains authoritative. W1 may expose/adapt it, but must not create a second eligibility engine with different rules.

Even after an earlier `eligible` result, every actual byte consumer must re-resolve/revalidate at its own open boundary. A previous check or operation proof is never universal read authorization.

## 6. Ephemeral Browse

Browse is session-scoped, progressive and non-durable.

```ts
interface BrowseSession {
  id: string;
  location: LocationRef;
  target: BrowseNavigationTarget;
  requestEpoch: number;
  state: "idle" | "enumerating" | "ready" | "unavailable" | "failed" | "disposed";
}
```

Ephemeral entries contain only filesystem/browse facts plus an optional proven managed link:

```ts
interface EphemeralEntry {
  ref: EphemeralEntryRef;
  name: string;
  displayPath: string;
  kind: "file" | "directory";
  extension?: string;
  size?: number;
  modifiedAt?: number;
  createdAt?: number;
  materialization: MaterializationState;
  managedRef?: ManagedEntryRef;
}
```

Ephemeral entries do not own durable tags, classification, findings, lifecycle or content artifacts.

## 7. Progressive enumeration and cursor validity

Browse can return partial pages before directory enumeration completes.

Every page/cursor is bound to the current Browse session **and one enumeration generation**:

```ts
interface BrowsePage {
  sessionId: string;
  requestId: string;
  enumerationId: string;
  entries: EphemeralEntry[];
  nextCursor: string | null;
  completion: "partial" | "complete";
  knownCount?: number;
}
```

Rules:

- loaded count must never be presented as an exact total until completeness is proven;
- cursors are opaque and valid only for the enumeration that issued them;
- invalidation/re-enumeration creates a new `enumerationId` and revokes publication rights for old pages/cursors;
- session/request/enumeration mismatch is fail-closed and stale pages are discarded.

This is the Ephemeral Browse equivalent of the existing Query V2 stale-publication protections; it does not create a durable filesystem snapshot authority.

## 8. Promotion to managed

`Add this location to Library` uses existing scan-root admission and managed indexing.

Ephemeral rows are not bulk-inserted as new durable truth. Identity linking occurs only when backend evidence proves continuity. Ambiguous continuity fails closed.

Session state such as focus/selection/preview may migrate to the proven managed entry. Ephemeral entries do not carry durable tags to migrate.

## 9. NavigationTarget

```ts
type NavigationTarget = LibraryNavigationTarget | BrowseNavigationTarget;
```

Library targets compile to existing `FileQuerySpecV2`.

Browse targets contain a `LocationRef` and opaque `BrowsePathRef`. Display paths are presentation, not filesystem authorization.

`BrowsePathRef`, Ephemeral `LocationRef` and Ephemeral `EntryRef` are process/session scoped. They must never be persisted as cross-process authorization.

## 10. Workspace restore locator

Cross-process restoration uses a separate, non-authoritative `WorkspaceRestoreLocator` / `BrowseRestoreBookmark`.

It may persist enough presentation/routing information to attempt restoring a prior Browse location, but:

- it is not an `EntryRef`, `LocationRef` or `BrowsePathRef`;
- it is never accepted as direct filesystem/byte-read authorization;
- restart always resolves it into a fresh session/location/path ref and revalidates current platform capability/availability;
- failed/unsafe restore falls back to a safe File Library target.

Persistent per-target presentation preferences should likewise key from a stable presentation/restore identity, not from an ephemeral session token.

## 11. Workspace Search Scope

Use a distinct name from existing search configuration types:

- current_target
- current_folder
- current_location
- managed_library

`managed_library` always returns to Query V2; it is not Global Search.

For v1, arbitrary unmanaged recursive `current_location` search is not guaranteed. It may be offered only when an existing managed/indexed authority can satisfy it without creating a second recursive filesystem/global search engine.

## 12. Selection

Managed selection remains `LibrarySelectionV1`.

Ephemeral selection is separate and explicit-only in W1:

```ts
interface EphemeralSelection {
  sessionId: string;
  entries: EphemeralEntryRef[];
  focusedEntry?: EphemeralEntryRef;
}
```

No W1 recursive/all-matching ephemeral selection engine.

## 13. LocationCapabilities

Capabilities are projected from platform/runtime evidence rather than `isMac`/`isWindows` UI branches.

At minimum:

- canBrowse
- canReadMetadata
- canPreview
- canWatch
- canRequestMaterialization
- canAddToLibrary

These are coarse location/runtime capabilities only. Per-entry content state/read eligibility remains entry/source scoped, and mutation capability remains owned by the existing mutation/preflight authority.

## 14. Thumbnail/cache identity constraint

A durable thumbnail disk-cache key may reuse across rename/move only when Zen has a stable, backend-verified source/content identity suitable for that cache lifetime.

If the only identity is an Ephemeral session-scoped reference, persistent cross-session cache reuse must fail closed; session/memory caching is allowed. Path strings alone are never promoted into stable cache identity merely to improve hit rate.

## 15. Workspace recovery terminology

Use `WorkspaceRecoveryPolicy`, not `SafeRestore`, to avoid conflict with filesystem Restore.
