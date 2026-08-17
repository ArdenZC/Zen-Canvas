import type {
  BrowseOpenRequest,
  BrowseOpenResponse,
  BrowsePage,
  BrowseRestoreRequest,
  BrowseStartEnumerationRequest,
  ChangePendingResponse,
  ChangeStartRequest,
  ChangeStartResponse,
  LocationDescriptor,
  PreviewCreateRequest,
  PreviewSnapshot,
  ReadEligibilityRequest,
  ReadEligibilityResponse,
  ThumbnailRequest
} from "../types/fileWorkspace";

const FILE_WORKSPACE_COMMANDS = new Set([
  "file_workspace_browse_open",
  "file_workspace_browse_restore",
  "file_workspace_browse_start_enumeration",
  "file_workspace_browse_next_page",
  "file_workspace_browse_cancel_enumeration",
  "file_workspace_browse_release_page",
  "file_workspace_browse_release_path",
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

interface MockBrowseSession {
  sessionId: string;
  location: BrowseOpenResponse["location"];
  rootPathRef: { id: string };
  generation: number;
  pathRefs: Set<string>;
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
    case "file_workspace_browse_start_enumeration":
      return startEnumeration(request as unknown as BrowseStartEnumerationRequest) as T;
    case "file_workspace_browse_next_page":
      return nextPage(request) as T;
    case "file_workspace_browse_cancel_enumeration":
      cancelEnumeration(request);
      return undefined as T;
    case "file_workspace_browse_release_page":
    case "file_workspace_browse_release_path":
      return undefined as T;
    case "file_workspace_browse_dispose":
      disposeBrowse(request);
      return undefined as T;
    case "file_workspace_location_list":
      return [] as T;
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
    case "file_workspace_thumbnail_request":
      return thumbnailRequest(request as unknown as ThumbnailRequest) as T;
    case "file_workspace_thumbnail_cancel":
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
  const sessionId = id("browse");
  const location = {
    ref: { kind: "ephemeral" as const, browseSessionId: sessionId, locationId: id("location") },
    displayName: request.displayHint?.trim() || "Browse",
    kind: "unknown" as const,
    availability: "unknown" as const,
    freshness: "not_applicable" as const,
    capabilities: {
      canBrowse: false,
      canReadMetadata: false,
      canPreview: false,
      canWatch: false,
      canRequestMaterialization: false,
      canAddToLibrary: false
    }
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
    disposed: false
  });
  return response;
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
      materialization: "unknown" as const
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
  const folderPath = allEntries[1].pathRef;
  if (folderPath !== undefined) session.pathRefs.add(folderPath.id);
  const limit = Math.max(1, Math.min(256, Number.isFinite(pageSize) ? pageSize : 1));
  const entries = complete ? allEntries.slice(limit) : allEntries.slice(0, limit);
  return {
    sessionId: session.sessionId,
    requestId,
    enumerationId,
    entries,
    ...(complete ? {} : { nextCursor: session.enumeration?.cursor }),
    completion: complete ? "complete" : "partial",
    knownCount: allEntries.length
  };
}

function cancelEnumeration(request: MockArgs) {
  const session = getSession(String(request?.sessionId ?? ""));
  if (!session.enumeration || session.enumeration.enumerationId !== String((request?.enumeration as { enumerationId?: string } | undefined)?.enumerationId ?? "")) {
    throw new Error("browse_enumeration_stale");
  }
  session.enumeration = undefined;
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

function thumbnailRequest(request: ThumbnailRequest) {
  if (!request || !request.source || "path" in (request.source as Record<string, unknown>)) {
    throw new Error("thumbnail_request_invalid");
  }
  throw new Error("thumbnail_renderer_unsupported_browser_mock");
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
