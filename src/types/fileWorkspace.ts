/**
 * Shared File Library 2.0 / Preview Platform wire contracts.
 *
 * These are serialized references and projections only. Authority-bearing
 * opaque refs and leases never contain filesystem paths or provide authority
 * to resolve, read, materialize, query, watch or mutate anything. Restore
 * locators may retain path-like routing hints as non-authoritative metadata.
 */

export type EntryRef =
  | {
      kind: "managed";
      /** Existing managed File Library identity. */
      fileId: string;
    }
  | {
      kind: "ephemeral";
      /** Session-scoped, non-durable identity. */
      browseSessionId: string;
      entryId: string;
    };

export type LocationRef =
  | {
      kind: "managed";
      /** Existing managed scan-root identity. */
      scanRootId: string;
    }
  | {
      kind: "ephemeral";
      /** Session-scoped, non-durable identity. */
      browseSessionId: string;
      locationId: string;
    };

/** Opaque session-scoped path reference; never a filesystem path. */
export interface BrowsePathRef {
  id: string;
}

export type LibraryNavigationSource =
  | "smart_view"
  | "saved_view"
  | "tag"
  | "search"
  | "custom";

export type NavigationTarget =
  | {
      kind: "library";
      source: LibraryNavigationSource;
      key: string;
    }
  | {
      kind: "browse";
      location: LocationRef;
      pathRef: BrowsePathRef;
    };

export interface BrowseEnumerationRef {
  sessionId: string;
  requestId: string;
  enumerationId: string;
}

export type WorkspacePlatform = "macos" | "windows";

/** Persistent routing/presentation metadata, never a live workspace authority. */
export type WorkspaceRestoreLocator =
  | {
      kind: "library";
      source: LibraryNavigationSource;
      key: string;
    }
  | {
      kind: "browse";
      platform: WorkspacePlatform;
      routingHint: string;
      displayHint?: string;
    };

export type LocationKind = "local" | "external" | "network" | "cloud_provider" | "unknown";

export type LocationAvailability =
  | "available"
  | "offline"
  | "disconnected"
  | "permission_denied"
  | "authentication_required"
  | "not_found"
  | "unknown";

export type LocationFreshness = "current" | "stale" | "reconciling" | "unknown" | "not_applicable";

/** Entry/source-scoped content/materialization projection, not read authority. */
export type MaterializationState =
  | "local"
  | "boundary_readable"
  | "metadata_only"
  | "remote_placeholder"
  | "hydrating"
  | "unavailable"
  | "unknown";

/** Projection over the existing authoritative byte-read/open boundary. */
export type ContentReadEligibility =
  | "eligible"
  | "materialization_required"
  | "downloading"
  | "metadata_only"
  | "permission_required"
  | "source_unavailable"
  | "source_not_supported"
  | "package_unsupported"
  | "symlink"
  | "identity_changed"
  | "availability_unknown";

export type WorkClass = "foreground" | "interactive" | "background";

export type PreviewSourceRef =
  | {
      kind: "managed";
      fileId: string;
    }
  | {
      kind: "ephemeral";
      browseSessionId: string;
      entryId: string;
    }
  | {
      kind: "host_provided";
      hostToken: string;
    };

export type PreviewHostKind =
  | "zen_floating"
  | "zen_pinned"
  | "mac_quick_look_extension"
  | "windows_quick_preview"
  | "windows_preview_handler";

/** Opaque request/source-version-bound content access handle; never a path. */
export interface ContentReadLeaseRef {
  leaseId: string;
  requestId: string;
  sourceVersion: string;
}

export interface LocationCapabilities {
  canBrowse: boolean;
  canReadMetadata: boolean;
  canPreview: boolean;
  canWatch: boolean;
  canRequestMaterialization: boolean;
  canAddToLibrary: boolean;
}

/**
 * Non-authoritative Location projection. It contains only coarse runtime
 * capabilities; materialization and byte-read eligibility remain
 * entry/source-scoped projections.
 */
export interface LocationDescriptor {
  ref: LocationRef;
  displayName: string;
  kind: LocationKind;
  availability: LocationAvailability;
  freshness: LocationFreshness;
  capabilities: LocationCapabilities;
}
