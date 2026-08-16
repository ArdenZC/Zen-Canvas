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
  materialization: MaterializationState;
  capabilities: LocationCapabilities;
}
```

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

## 4. Materialization

Cross-platform materialization state:

- local
- metadata_only
- remote_placeholder
- hydrating
- unavailable
- unknown

Policy v1:

- `never_implicit`
- `user_initiated_only`

There is no v1 auto-download policy.

PR #63 rule: generic File Provider path/routing information is not provider identity. Runtime capability and byte-read eligibility must fail closed where native provider identity/materialization proof is unavailable.

## 5. Ephemeral Browse

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

## 6. Progressive enumeration

Browse can return partial pages before directory enumeration completes:

```ts
interface BrowsePage {
  entries: EphemeralEntry[];
  nextCursor: string | null;
  completion: "partial" | "complete";
  knownCount?: number;
}
```

Loaded count must never be presented as an exact total until completeness is proven.

## 7. Promotion to managed

`Add this location to Library` uses existing scan-root admission and managed indexing.

Ephemeral rows are not bulk-inserted as new durable truth. Identity linking occurs only when backend evidence proves continuity. Ambiguous continuity fails closed.

Session state such as focus/selection/preview may migrate to the proven managed entry. Ephemeral entries do not carry durable tags to migrate.

## 8. NavigationTarget

```ts
type NavigationTarget = LibraryNavigationTarget | BrowseNavigationTarget;
```

Library targets compile to existing `FileQuerySpecV2`.

Browse targets contain a `LocationRef` and opaque `BrowsePathRef`. Display paths are presentation, not filesystem authorization.

## 9. Workspace Search Scope

Use a distinct name from existing search configuration types:

- current_target
- current_folder
- current_location
- managed_library

`managed_library` always returns to Query V2; it is not Global Search.

## 10. Selection

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

## 11. LocationCapabilities

Capabilities are projected from platform/runtime evidence rather than `isMac`/`isWindows` UI branches.

At minimum:

- canBrowse
- canReadMetadata
- canPreview
- canWatch
- canRequestMaterialization
- canAddToLibrary

Mutation capability remains owned by the existing mutation/preflight authority and is intentionally absent from this contract.

## 12. Workspace recovery terminology

Use `WorkspaceRecoveryPolicy`, not `SafeRestore`, to avoid conflict with filesystem Restore.
