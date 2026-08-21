import type {
  BrowseOpenRequest,
  BrowseOpenResponse,
  BrowsePage,
  BrowseRestoreRequest,
  BrowseStartEnumerationRequest,
  ChangePendingResponse,
  ChangeStartRequest,
  ChangeStartResponse,
  LocationBrowseRequest,
  LocationDescriptor,
  LocationRef,
  PreviewCreateRequest,
  PreviewSnapshot,
  ReadEligibilityRequest,
  ReadEligibilityResponse,
  ThumbnailRequest
} from "../types/fileWorkspace";

const FILE_WORKSPACE_COMMANDS = new Set([
  "file_workspace_browse_open",
  "file_workspace_browse_restore",
  "file_workspace_location_browse",
  "file_workspace_browse_start_enumeration",
  "file_workspace_browse_next_page",
  "file_workspace_browse_cancel_enumeration",
  "file_workspace_browse_release_page",
  "file_workspace_browse_release_path",
  "file_workspace_browse_retain_path",
  "file_workspace_browse_dispose",
  "file_workspace_location_list",
  "file_workspace_change_start",
  "file_workspace_change_pending",
  "file_workspace_change_refresh",
  "file_workspace_change_dispose",
  "file_workspace_read_eligibility",
  "file_workspace_thumbnail_request",
  "file_workspace_thumbnail_cancel",
  "file_workspace_preview_create",
  "file_workspace_preview_snapshot",
  "file_workspace_preview_start",
  "file_workspace_preview_cancel",
  "file_workspace_preview_dispose",
  "file_workspace_preview_switch_source"
]);

type MockArgs = Record<string, unknown> | undefined;

interface MockEnumeration {
  requestId: string;
  enumerationId: string;
  cursor?: string;
  generation: number;
}

interface MockEntry {
  enumerationId: string;
  pathRefId?: string;
}

interface MockBrowseSession {
  sessionId: string;
  location: BrowseOpenResponse["location"];
  rootPathRef: { id: string };
  generation: number;
  pathRefs: Set<string>;
  retainedPathRefs: Set<string>;
  entries: Map<string, MockEntry>;
  enumeration?: MockEnumeration;
  disposed: boolean;
}

interface MockPreviewRecord {
  snapshot: PreviewSnapshot;
}

const sessions = new Map<string, MockBrowseSession>();
const previews = new Map<string, MockPreviewRecord>();
const monitors = new Map<string, string>();
let nextId = 1;

// A tiny valid PNG keeps the browser-only thumbnail seam deterministic. It is
// a presentation fixture, not evidence of native renderer support.
const MOCK_THUMBNAIL_BYTES = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 4, 0, 0, 0, 181, 28, 12, 2,
  0, 0, 0, 11, 73, 68, 65, 84, 120, 218, 99, 100, 96, 0, 0, 0, 2, 0, 1, 229, 39, 212, 162,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
]);

const MOCK_MANAGED_LOCATION_REF: Extract<LocationRef, { kind: "managed" }> = {
  kind: "managed",
  scanRootId: "mock-scan-root"
};

const MOCK_MANAGED_LOCATION: LocationDescriptor = {
  ref: MOCK_MANAGED_LOCATION_REF,
  displayName: "Managed mock root",
  kind: "unknown",
  availability: "available",
  freshness: "current",
  capabilities: {
    canBrowse: true,
    canReadMetadata: false,
    canPreview: false,
    canWatch: false,
    canRequestMaterialization: false,
    canAddToLibrary: false
  }
};

const MOCK_UNAVAILABLE_LOCATION: LocationDescriptor = {
  ref: { kind: "managed", scanRootId: "mock-offline-root" },
  displayName: "Unavailable mock root",
  kind: "network",
  availability: "offline",
  freshness: "stale",
  capabilities: {
    canBrowse: false,
    canReadMetadata: false,
    canPreview: false,
    canWatch: false,
    canRequestMaterialization: false,
    canAddToLibrary: false
  }
};

const MOCK_UNMANAGED_LOCATION: LocationDescriptor = {
  ref: {
    kind: "ephemeral",
    browseSessionId: "mock-unmanaged-location",
    locationId: "mock-external-drive"
  },
  displayName: "Unmanaged mock drive",
  kind: "external",
  availability: "available",
  freshness: "not_applicable",
  capabilities: {
    canBrowse: true,
    canReadMetadata: false,
    canPreview: false,
    canWatch: false,
    canRequestMaterialization: false,
    canAddToLibrary: false
  }
};

function isW209PlatformFixtureEnabled() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("w2-09-browser-fixture") === "platform";
}

export function isFileWorkspaceMockCommand(command: string) {
  return FILE_WORKSPACE_COMMANDS.has(command);
}

export async function mockFileWorkspaceInvoke<T>(
  command: string,
  args?: MockArgs
): Promise<T> {
  const request = args?.request as Record<string, unknown> | undefined;
  switch (command) {
    case "file_workspace_browse_open":
      return openBrowse(request as unknown as BrowseOpenRequest) as T;
    case "file_workspace_browse_restore":
      return restoreBrowse(request as unknown as BrowseRestoreRequest) as T;
    case "file_workspace_location_browse":
      return browseLocation(request as unknown as LocationBrowseRequest) as T;
    case "file_workspace_browse_start_enumeration":
      return startEnumeration(request as unknown as BrowseStartEnumerationRequest) as T;
    case "file_workspace_browse_next_page":
      return nextPage(request) as T;
    case "file_workspace_browse_cancel_enumeration":
      cancelEnumeration(request);
      return undefined as T;
    case "file_workspace_browse_release_page":
      releasePage(request);
      return undefined as T;
    case "file_workspace_browse_release_path":
      releasePath(request);
      return undefined as T;
    case "file_workspace_browse_retain_path":
      retainPath(request);
      return undefined as T;
    case "file_workspace_browse_dispose":
      disposeBrowse(request);
      return undefined as T;
    case "file_workspace_location_list":
      return (isW209PlatformFixtureEnabled()
        ? [MOCK_MANAGED_LOCATION, MOCK_UNMANAGED_LOCATION, MOCK_UNAVAILABLE_LOCATION]
        : [MOCK_MANAGED_LOCATION, MOCK_UNAVAILABLE_LOCATION]
      ).map((location) => ({
        ...location,
        ref: { ...location.ref },
        capabilities: { ...location.capabilities }
      })) as T;
    case "file_workspace_change_start":
      return startChange(request as unknown as ChangeStartRequest) as T;
    case "file_workspace_change_pending":
      return pendingChange(request) as T;
    case "file_workspace_change_refresh":
      throw new Error("ephemeral_change_refresh_not_pending");
    case "file_workspace_change_dispose":
      monitors.delete(String(request?.monitorId ?? ""));
      return undefined as T;
    case "file_workspace_read_eligibility":
      return readEligibility(request as unknown as ReadEligibilityRequest) as T;
    case "file_workspace_thumbnail_request": {
      const artifact = await thumbnailRequest(request as unknown as ThumbnailRequest);
      return encodeThumbnailIpcResponse(artifact.cacheKey, artifact.bytes) as T;
    }
    case "file_workspace_thumbnail_cancel":
      recordW206ThumbnailCancel();
      return false as T;
    case "file_workspace_preview_create":
      return createPreview(request as unknown as PreviewCreateRequest) as T;
    case "file_workspace_preview_snapshot":
      return previewSnapshot(request) as T;
    case "file_workspace_preview_start":
      return previewStart(request) as T;
    case "file_workspace_preview_cancel":
      return cancelPreview(request) as T;
    case "file_workspace_preview_dispose":
      disposePreview(request);
      return true as T;
    case "file_workspace_preview_switch_source":
      return switchPreviewSource(request) as T;
    default:
      throw new Error(`browser_mock_unknown_file_workspace_command:${command}`);
  }
}

function openBrowse(request: BrowseOpenRequest): BrowseOpenResponse {
  if (!request || typeof request.routingHint !== "string" || request.routingHint.length === 0) {
    throw new Error("browse_routing_hint_invalid");
  }
  return newBrowseSession(request.displayHint?.trim() || "Browse", true);
}

function browseLocation(request: LocationBrowseRequest): BrowseOpenResponse {
  if (!isLocationBrowseRequest(request)) {
    throw new Error("workspace_location_request_invalid");
  }

  if (request.location.kind === "managed") {
    if (request.location.scanRootId !== MOCK_MANAGED_LOCATION_REF.scanRootId) {
      throw new Error("workspace_location_ref_unknown");
    }
    return newBrowseSession(MOCK_MANAGED_LOCATION.displayName, true);
  }

  if (request.location.kind === "ephemeral"
    && MOCK_UNMANAGED_LOCATION.ref.kind === "ephemeral"
    && request.location.browseSessionId === MOCK_UNMANAGED_LOCATION.ref.browseSessionId
    && request.location.locationId === MOCK_UNMANAGED_LOCATION.ref.locationId) {
    return newBrowseSession(MOCK_UNMANAGED_LOCATION.displayName, true);
  }

  const source = sessions.get(request.location.browseSessionId);
  if (source === undefined || source.disposed) {
    throw new Error("workspace_location_ref_stale");
  }
  if (source.location.ref.kind !== "ephemeral"
    || source.location.ref.locationId !== request.location.locationId) {
    throw new Error("workspace_location_ref_mismatch");
  }
  return newBrowseSession(source.location.displayName || "Browse", true);
}

function newBrowseSession(displayName: string, admitted: boolean): BrowseOpenResponse {
  const sessionId = id("browse");
  const location = {
    ref: { kind: "ephemeral" as const, browseSessionId: sessionId, locationId: id("location") },
    displayName,
    kind: "unknown" as const,
    availability: admitted ? "available" as const : "unknown" as const,
    freshness: "not_applicable" as const,
    capabilities: locationCapabilities(admitted)
  } satisfies LocationDescriptor;
  const response: BrowseOpenResponse = {
    sessionId,
    location,
    rootPathRef: { id: id("path") }
  };
  sessions.set(sessionId, {
    sessionId,
    location,
    rootPathRef: response.rootPathRef,
    generation: 0,
    pathRefs: new Set([response.rootPathRef.id]),
    retainedPathRefs: new Set([response.rootPathRef.id]),
    entries: new Map(),
    disposed: false
  });
  return response;
}

function locationCapabilities(canBrowse: boolean) {
  return {
    canBrowse,
    canReadMetadata: false,
    canPreview: false,
    canWatch: false,
    canRequestMaterialization: false,
    canAddToLibrary: false
  };
}

function isLocationBrowseRequest(request: unknown): request is LocationBrowseRequest {
  if (!request || typeof request !== "object") return false;
  const record = request as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !("location" in record)) return false;
  const location = record.location;
  if (!location || typeof location !== "object") return false;
  const value = location as Record<string, unknown>;
  if (value.kind === "managed") {
    return Object.keys(value).every((key) => key === "kind" || key === "scanRootId")
      && isOpaqueId(value.scanRootId)
      && !looksLikePath(value.scanRootId);
  }
  if (value.kind === "ephemeral") {
    return Object.keys(value).every((key) =>
      key === "kind" || key === "browseSessionId" || key === "locationId")
      && isOpaqueId(value.browseSessionId)
      && isOpaqueId(value.locationId)
      && !looksLikePath(value.browseSessionId)
      && !looksLikePath(value.locationId);
  }
  return false;
}

function restoreBrowse(request: BrowseRestoreRequest): BrowseOpenResponse {
  if (request.locator.kind !== "browse") throw new Error("workspace_restore_requires_browse_locator");
  return openBrowse({
    platform: request.locator.platform,
    routingHint: request.locator.routingHint,
    ...(request.locator.displayHint === undefined ? {} : { displayHint: request.locator.displayHint })
  });
}

function startEnumeration(request: BrowseStartEnumerationRequest): BrowsePage {
  const session = getSession(request.sessionId);
  if (!session.pathRefs.has(request.pathRef.id)) throw new Error("browse_path_ref_invalid");
  if (session.enumeration !== undefined) {
    invalidateEntriesForEnumeration(session, session.enumeration.enumerationId);
  }
  session.generation += 1;
  const enumerationId = `${session.sessionId}-enumeration-${session.generation}`;
  const cursor = `${enumerationId}-cursor`;
  session.enumeration = {
    requestId: request.requestId,
    enumerationId,
    cursor,
    generation: session.generation
  };
  return makePage(session, request.requestId, enumerationId, request.pageSize, false);
}

function nextPage(request: MockArgs): BrowsePage {
  const session = getSession(String(request?.sessionId ?? ""));
  const enumeration = session.enumeration;
  if (!enumeration || request?.cursor !== enumeration.cursor) throw new Error("browse_cursor_invalid");
  session.enumeration = { ...enumeration, cursor: undefined };
  return makePage(session, enumeration.requestId, enumeration.enumerationId, Number(request?.pageSize ?? 1), true);
}

function makePage(
  session: MockBrowseSession,
  requestId: string,
  enumerationId: string,
  pageSize: number,
  complete: boolean
): BrowsePage {
  const allEntries = [
    {
      ref: { kind: "ephemeral" as const, browseSessionId: session.sessionId, entryId: `${enumerationId}-file` },
      name: "mock-file.txt",
      displayPath: "mock-file.txt",
      kind: "file" as const,
      extension: "txt",
      size: 12,
      modifiedAt: 1,
      createdAt: 1,
      materialization: isW206ThumbnailFixtureEnabled() ? "boundary_readable" as const : "unknown" as const
    },
    {
      ref: { kind: "ephemeral" as const, browseSessionId: session.sessionId, entryId: `${enumerationId}-folder` },
      pathRef: { id: `${enumerationId}-folder-path` },
      name: "mock-folder",
      displayPath: "mock-folder",
      kind: "directory" as const,
      materialization: "unknown" as const
    }
  ];
  const limit = Math.max(1, Math.min(256, Number.isFinite(pageSize) ? pageSize : 1));
  const entries = complete ? allEntries.slice(limit) : allEntries.slice(0, limit);
  for (const entry of entries) {
    if (entry.pathRef !== undefined) session.pathRefs.add(entry.pathRef.id);
    session.entries.set(entry.ref.entryId, {
      enumerationId,
      ...(entry.pathRef === undefined ? {} : { pathRefId: entry.pathRef.id })
    });
  }
  return {
    sessionId: session.sessionId,
    requestId,
    enumerationId,
    entries,
    ...(complete ? {} : { nextCursor: session.enumeration?.cursor }),
    completion: complete ? "complete" : "partial",
    ...(complete ? { knownCount: allEntries.length } : {})
  };
}

function cancelEnumeration(request: MockArgs) {
  const session = getSession(String(request?.sessionId ?? ""));
  const hasEnumeration = request?.enumeration !== undefined;
  const hasRequestId = request?.requestId !== undefined;
  if (hasEnumeration === hasRequestId
    || (hasRequestId && String(request?.requestId ?? "").length === 0)) {
    throw new Error("browse_cancel_requires_exactly_one_identity");
  }
  const requestedEnumerationId = (request?.enumeration as { enumerationId?: string } | undefined)?.enumerationId;
  const requestedRequestId = request?.requestId;
  if (!session.enumeration
    || (requestedEnumerationId !== undefined
      && session.enumeration.enumerationId !== String(requestedEnumerationId))
    || (requestedEnumerationId === undefined
      && session.enumeration.requestId !== String(requestedRequestId ?? ""))) {
    throw new Error("browse_enumeration_stale");
  }
  const enumerationId = session.enumeration.enumerationId;
  session.enumeration = undefined;
  invalidateEntriesForEnumeration(session, enumerationId);
}

function releasePage(request: MockArgs) {
  const page = request?.page as BrowsePage | undefined;
  if (!page || typeof page.sessionId !== "string") throw new Error("browse_page_invalid");
  const session = getSession(page.sessionId);
  for (const entry of page.entries) {
    if (entry.ref.browseSessionId !== page.sessionId) continue;
    const stored = session.entries.get(entry.ref.entryId);
    if (stored === undefined || stored.enumerationId !== page.enumerationId) continue;
    session.entries.delete(entry.ref.entryId);
    if (stored.pathRefId !== undefined) removePathIfUnpinned(session, stored.pathRefId);
  }
}

function releasePath(request: MockArgs) {
  const session = getSession(String(request?.sessionId ?? ""));
  const pathRef = request?.pathRef as { id?: string } | undefined;
  if (typeof pathRef?.id !== "string" || !session.pathRefs.has(pathRef.id)) {
    throw new Error("browse_path_ref_invalid");
  }
  if (pathRef.id === session.rootPathRef.id) return;
  session.retainedPathRefs.delete(pathRef.id);
  removePathIfUnpinned(session, pathRef.id);
}

function invalidateEntriesForEnumeration(session: MockBrowseSession, enumerationId: string) {
  for (const [entryId, entry] of session.entries) {
    if (entry.enumerationId !== enumerationId) continue;
    session.entries.delete(entryId);
    if (entry.pathRefId !== undefined) removePathIfUnpinned(session, entry.pathRefId);
  }
}

function removePathIfUnpinned(session: MockBrowseSession, pathRefId: string) {
  if (session.retainedPathRefs.has(pathRefId)) return;
  for (const entry of session.entries.values()) {
    if (entry.pathRefId === pathRefId) return;
  }
  session.pathRefs.delete(pathRefId);
}

function retainPath(request: MockArgs) {
  const session = getSession(String(request?.sessionId ?? ""));
  const pathRef = request?.pathRef as { id?: string } | undefined;
  if (typeof pathRef?.id !== "string" || !session.pathRefs.has(pathRef.id)) {
    throw new Error("browse_path_ref_invalid");
  }
  session.retainedPathRefs.add(pathRef.id);
}

function disposeBrowse(request: MockArgs) {
  const sessionId = String(request?.sessionId ?? "");
  if (!sessions.delete(sessionId)) throw new Error("browse_session_not_found");
  for (const [monitorId, ownerSessionId] of monitors) {
    if (ownerSessionId === sessionId) monitors.delete(monitorId);
  }
}

function startChange(request: ChangeStartRequest): ChangeStartResponse {
  const session = getSession(request.sessionId);
  if (!session.pathRefs.has(request.pathRef.id)) throw new Error("browse_path_ref_invalid");
  const monitorId = id("change");
  monitors.set(monitorId, request.sessionId);
  return { monitorId, sessionId: request.sessionId, pathRef: request.pathRef };
}

function pendingChange(request: MockArgs): ChangePendingResponse | null {
  if (!monitors.has(String(request?.monitorId ?? ""))) throw new Error("ephemeral_change_monitor_not_found");
  return null;
}

function readEligibility(request: ReadEligibilityRequest): ReadEligibilityResponse {
  if ("path" in (request.source as Record<string, unknown>)) throw new Error("content_source_not_supported");
  return {
    source: request.source,
    eligibility: request.source.kind === "host_provided" ? "source_not_supported" : "eligible"
  };
}

function isW206ThumbnailFixtureEnabled() {
  return typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("w2-06-browser-fixture") === "grid";
}

async function thumbnailRequest(request: ThumbnailRequest) {
  if (!isThumbnailRequestShape(request)) {
    throw new Error("thumbnail_request_invalid");
  }
  if (request.source.kind === "ephemeral") {
    if (request.sessionId !== undefined && request.sessionId !== request.source.browseSessionId) {
      throw new Error("thumbnail_request_invalid");
    }
    const session = sessions.get(request.source.browseSessionId);
    if (session === undefined || session.disposed
      || !session.entries.has(request.source.entryId)) {
      throw new Error("thumbnail_source_unavailable");
    }
  }
  if (!isW206ThumbnailFixtureEnabled()) {
    throw new Error("thumbnail_renderer_unsupported_browser_mock");
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  return {
    cacheKey: `browser-mock-thumbnail:${request.source.kind}:${request.variant}`,
    bytes: new Uint8Array(MOCK_THUMBNAIL_BYTES)
  };
}

function recordW206ThumbnailCancel() {
  if (!isW206ThumbnailFixtureEnabled() || typeof window === "undefined") return;
  const testWindow = window as Window & { __zcW206ThumbnailCancels?: number };
  testWindow.__zcW206ThumbnailCancels = (testWindow.__zcW206ThumbnailCancels ?? 0) + 1;
}

function isThumbnailRequestShape(request: ThumbnailRequest): request is ThumbnailRequest {
  if (!request || typeof request !== "object") return false;
  const keys = Object.keys(request as unknown as Record<string, unknown>);
  const allowedKeys = new Set(["requestId", "source", "variant", "workClass", "sessionId"]);
  if (keys.some((key) => !allowedKeys.has(key))) return false;
  if (!isOpaqueId(request.requestId)
    || !["small", "medium", "large"].includes(request.variant)
    || !["foreground", "interactive", "background"].includes(request.workClass)) {
    return false;
  }
  if (request.sessionId !== undefined && !isOpaqueId(request.sessionId)) return false;
  if (!request.source || typeof request.source !== "object") return false;
  const source = request.source as Record<string, unknown>;
  if (source.kind === "managed") {
    return Object.keys(source).every((key) => key === "kind" || key === "fileId")
      && isOpaqueId(source.fileId)
      && !looksLikePath(source.fileId);
  }
  if (source.kind === "ephemeral") {
    return Object.keys(source).every((key) =>
      key === "kind" || key === "browseSessionId" || key === "entryId")
      && isOpaqueId(source.browseSessionId)
      && isOpaqueId(source.entryId)
      && !looksLikePath(source.browseSessionId)
      && !looksLikePath(source.entryId);
  }
  return false;
}

function encodeThumbnailIpcResponse(cacheKey: string, artifactBytes: Uint8Array): ArrayBuffer {
  const cacheKeyBytes = new TextEncoder().encode(cacheKey);
  const payload = new Uint8Array(13 + cacheKeyBytes.byteLength + artifactBytes.byteLength);
  payload.set([0x5a, 0x43, 0x54, 0x48, 1], 0);
  const view = new DataView(payload.buffer);
  view.setUint32(5, cacheKeyBytes.byteLength, true);
  view.setUint32(9, artifactBytes.byteLength, true);
  payload.set(cacheKeyBytes, 13);
  payload.set(artifactBytes, 13 + cacheKeyBytes.byteLength);
  return payload.buffer;
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !value.includes("\0");
}

function looksLikePath(value: string) {
  return value.includes("/") || value.includes("\\") || value.startsWith("C:");
}

function createPreview(request: PreviewCreateRequest): PreviewSnapshot {
  const previewId = id("preview");
  const snapshot: PreviewSnapshot = {
    previewId,
    sessionId: previewId,
    requestId: request.requestId,
    source: request.source,
    hostKind: request.hostKind,
    state: "idle",
    effectiveCapabilities: metadataCapabilities()
  };
  previews.set(previewId, { snapshot });
  return snapshot;
}

function previewSnapshot(request: MockArgs): PreviewSnapshot {
  return getPreview(String(request?.previewId ?? "")).snapshot;
}

function previewStart(request: MockArgs): PreviewSnapshot {
  const record = getPreview(String(request?.previewId ?? ""));
  const snapshot = record.snapshot;
  const metadata = mockMetadata(snapshot.source);
  record.snapshot = {
    ...snapshot,
    state: "ready",
    sourceVersion: `browser-mock-v1-${snapshot.source.kind}`,
    representation: {
      sourceVersion: `browser-mock-v1-${snapshot.source.kind}`,
      representation: { family: "metadata", metadata },
      completeness: "complete",
      warnings: [{ kind: "metadata_fallback" }],
      capabilities: metadataCapabilities()
    },
    effectiveCapabilities: metadataCapabilities()
  };
  return record.snapshot;
}

function cancelPreview(request: MockArgs) {
  const record = getPreview(String(request?.previewId ?? ""));
  record.snapshot = { ...record.snapshot, state: "cancelled" };
  return true;
}

function disposePreview(request: MockArgs) {
  const previewId = String(request?.previewId ?? "");
  if (!previews.delete(previewId)) throw new Error("preview_session_not_found");
}

function switchPreviewSource(request: MockArgs): PreviewSnapshot {
  const record = getPreview(String(request?.previewId ?? ""));
  const source = request?.source as PreviewSnapshot["source"];
  record.snapshot = {
    ...record.snapshot,
    requestId: String(request?.requestId ?? ""),
    source,
    state: "resolving",
    sourceVersion: undefined,
    representation: undefined
  };
  return record.snapshot;
}

function mockMetadata(source: PreviewSnapshot["source"]) {
  return {
    displayName: source.kind === "managed" ? "Managed mock entry" : "Browse mock entry",
    mediaType: null,
    extension: null,
    sizeBytes: 0,
    modifiedAtEpochMs: null,
    materialization: "metadata_only" as const,
    readEligibility: source.kind === "host_provided" ? "source_not_supported" as const : "eligible" as const
  };
}

function metadataCapabilities() {
  return {
    canSearch: false,
    canZoom: false,
    canPlayback: false,
    canSelectText: false,
    canNavigateInternal: false,
    canNavigateSiblings: false,
    canOpenExternal: true,
    canReveal: true,
    canRequestMaterialization: true
  };
}

function getSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session || session.disposed) throw new Error("browse_session_not_found");
  return session;
}

function getPreview(previewId: string) {
  const record = previews.get(previewId);
  if (!record) throw new Error("preview_session_not_found");
  return record;
}

function id(prefix: string) {
  nextId += 1;
  return `mock-${prefix}-${nextId}`;
}
