import { describe, expect, it } from "vitest";
import type {
  BrowseEnumerationRef,
  BrowsePathRef,
  ContentReadEligibility,
  ContentReadLeaseRef,
  EntryRef,
  LocationAvailability,
  LocationCapabilities,
  LocationFreshness,
  LocationKind,
  LocationRef,
  MaterializationState,
  NavigationTarget,
  PreviewHostKind,
  PreviewSourceRef,
  WorkClass,
  WorkspaceRestoreLocator,
} from "../src/types/fileWorkspace";

const managedEntry = { kind: "managed", fileId: "file-1" } satisfies EntryRef;
const ephemeralEntry = {
  kind: "ephemeral",
  browseSessionId: "browse-1",
  entryId: "entry-1",
} satisfies EntryRef;

const managedLocation = { kind: "managed", scanRootId: "root-1" } satisfies LocationRef;
const ephemeralLocation = {
  kind: "ephemeral",
  browseSessionId: "browse-1",
  locationId: "location-1",
} satisfies LocationRef;

const browsePath = { id: "path-1" } satisfies BrowsePathRef;
const libraryTarget = {
  kind: "library",
  source: "saved_view",
  key: "recent-files",
} satisfies NavigationTarget;
const browseTarget = {
  kind: "browse",
  location: ephemeralLocation,
  pathRef: browsePath,
} satisfies NavigationTarget;

const enumeration = {
  sessionId: "browse-1",
  requestId: "request-1",
  enumerationId: "enumeration-1",
} satisfies BrowseEnumerationRef;

const restoreLocator = {
  kind: "browse",
  platform: "windows",
  routingHint: "Documents",
  displayHint: "Documents",
} satisfies WorkspaceRestoreLocator;

const capabilities = {
  canBrowse: true,
  canReadMetadata: true,
  canPreview: true,
  canWatch: false,
  canRequestMaterialization: false,
  canAddToLibrary: true,
} satisfies LocationCapabilities;

const previewSource = {
  kind: "host_provided",
  hostToken: "host-token-1",
} satisfies PreviewSourceRef;
const contentReadLease = {
  leaseId: "lease-1",
  requestId: "request-1",
  sourceVersion: "version-1",
} satisfies ContentReadLeaseRef;

describe("file workspace contract spine", () => {
  it("keeps managed and ephemeral identity refs distinct and opaque", () => {
    expect(managedEntry).toEqual({ kind: "managed", fileId: "file-1" });
    expect(ephemeralEntry).toEqual({
      kind: "ephemeral",
      browseSessionId: "browse-1",
      entryId: "entry-1",
    });
    expect(managedLocation).toEqual({ kind: "managed", scanRootId: "root-1" });
    expect(ephemeralLocation).toEqual({
      kind: "ephemeral",
      browseSessionId: "browse-1",
      locationId: "location-1",
    });
    expect(browsePath).not.toHaveProperty("path");
  });

  it("mirrors navigation, enumeration and non-authoritative restore shapes", () => {
    expect(libraryTarget).toEqual({ kind: "library", source: "saved_view", key: "recent-files" });
    expect(libraryTarget).not.toHaveProperty("pub_source");
    expect(browseTarget).toEqual({ kind: "browse", location: ephemeralLocation, pathRef: browsePath });
    expect(enumeration).toEqual({
      sessionId: "browse-1",
      requestId: "request-1",
      enumerationId: "enumeration-1",
    });
    expect(restoreLocator).not.toHaveProperty("browseSessionId");
    expect(restoreLocator).not.toHaveProperty("pathRef");
  });

  it("keeps location state, materialization and read eligibility as separate projections", () => {
    const locationKind: LocationKind = "cloud_provider";
    const availability: LocationAvailability = "authentication_required";
    const freshness: LocationFreshness = "reconciling";
    const materialization: MaterializationState = "boundary_readable";
    const eligibility: ContentReadEligibility = "materialization_required";
    const workClass: WorkClass = "foreground";

    expect({ locationKind, availability, freshness, materialization, eligibility, workClass, capabilities }).toEqual({
      locationKind: "cloud_provider",
      availability: "authentication_required",
      freshness: "reconciling",
      materialization: "boundary_readable",
      eligibility: "materialization_required",
      workClass: "foreground",
      capabilities,
    });
  });

  it("keeps preview hosts and content leases opaque", () => {
    const hostKind: PreviewHostKind = "mac_quick_look_extension";

    expect(previewSource).toEqual({ kind: "host_provided", hostToken: "host-token-1" });
    expect(hostKind).toBe("mac_quick_look_extension");
    expect(contentReadLease).toEqual({
      leaseId: "lease-1",
      requestId: "request-1",
      sourceVersion: "version-1",
    });
    expect(contentReadLease).not.toHaveProperty("path");
  });
});
