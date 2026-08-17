import { invokeCommand } from "./core";
import type {
  BrowseCancelRequest,
  BrowseNextPageRequest,
  BrowseOpenRequest,
  BrowseOpenResponse,
  BrowsePage,
  BrowseReleasePageRequest,
  BrowseReleasePathRequest,
  BrowseRetainPathRequest,
  BrowseRestoreRequest,
  BrowseSessionRequest,
  BrowseStartEnumerationRequest,
  ChangePendingRequest,
  ChangePendingResponse,
  ChangeRefreshRequest,
  ChangeStartRequest,
  ChangeStartResponse,
  LocationDescriptor,
  PreviewCreateRequest,
  PreviewSessionRequest,
  PreviewSnapshot,
  PreviewSwitchSourceRequest,
  ReadEligibilityRequest,
  ReadEligibilityResponse,
  ThumbnailArtifact,
  ThumbnailCancelRequest,
  ThumbnailRequest
} from "../types/fileWorkspace";

export interface FileWorkspaceApi {
  browseOpen(request: BrowseOpenRequest): Promise<BrowseOpenResponse>;
  browseRestore(request: BrowseRestoreRequest): Promise<BrowseOpenResponse>;
  browseStartEnumeration(request: BrowseStartEnumerationRequest): Promise<BrowsePage>;
  browseNextPage(request: BrowseNextPageRequest): Promise<BrowsePage>;
  browseCancel(request: BrowseCancelRequest): Promise<void>;
  browseReleasePage(request: BrowseReleasePageRequest): Promise<void>;
  browseReleasePath(request: BrowseReleasePathRequest): Promise<void>;
  browseRetainPath(request: BrowseRetainPathRequest): Promise<void>;
  browseDispose(request: BrowseSessionRequest): Promise<void>;
  locationList(): Promise<LocationDescriptor[]>;
  changeStart(request: ChangeStartRequest): Promise<ChangeStartResponse>;
  changePending(request: ChangePendingRequest): Promise<ChangePendingResponse | null>;
  changeRefresh(request: ChangeRefreshRequest): Promise<BrowsePage>;
  changeDispose(request: ChangePendingRequest): Promise<void>;
  readEligibility(request: ReadEligibilityRequest): Promise<ReadEligibilityResponse>;
  thumbnailRequest(request: ThumbnailRequest): Promise<ThumbnailArtifact>;
  thumbnailCancel(request: ThumbnailCancelRequest): Promise<boolean>;
  previewCreate(request: PreviewCreateRequest): Promise<PreviewSnapshot>;
  previewSnapshot(request: PreviewSessionRequest): Promise<PreviewSnapshot>;
  previewStart(request: PreviewSessionRequest): Promise<PreviewSnapshot>;
  previewCancel(request: PreviewSessionRequest): Promise<boolean>;
  previewDispose(request: PreviewSessionRequest): Promise<boolean>;
  previewSwitchSource(request: PreviewSwitchSourceRequest): Promise<PreviewSnapshot>;
}

function command<T>(name: string, request?: unknown): Promise<T> {
  return invokeCommand<T>(name, request === undefined ? undefined : { request });
}

const THUMBNAIL_IPC_MAGIC = [0x5a, 0x43, 0x54, 0x48] as const;
const THUMBNAIL_IPC_VERSION = 1;
const THUMBNAIL_IPC_HEADER_BYTES = 13;
const THUMBNAIL_IPC_MAX_BYTES = 16 * 1024 * 1024;

function decodeThumbnailIpcResponse(payload: ArrayBuffer | Uint8Array): ThumbnailArtifact {
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  if (bytes.byteLength < THUMBNAIL_IPC_HEADER_BYTES
    || THUMBNAIL_IPC_MAGIC.some((value, index) => bytes[index] !== value)
    || bytes[4] !== THUMBNAIL_IPC_VERSION) {
    throw new Error("thumbnail_ipc_payload_invalid");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cacheKeyBytes = view.getUint32(5, true);
  const artifactBytes = view.getUint32(9, true);
  const payloadBytes = THUMBNAIL_IPC_HEADER_BYTES + cacheKeyBytes + artifactBytes;
  if (cacheKeyBytes === 0
    || cacheKeyBytes > 4096
    || artifactBytes > THUMBNAIL_IPC_MAX_BYTES
    || payloadBytes !== bytes.byteLength) {
    throw new Error("thumbnail_ipc_payload_invalid");
  }

  let cacheKey: string;
  try {
    cacheKey = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(THUMBNAIL_IPC_HEADER_BYTES, THUMBNAIL_IPC_HEADER_BYTES + cacheKeyBytes)
    );
  } catch {
    throw new Error("thumbnail_ipc_metadata_invalid");
  }
  if (cacheKey.length === 0) throw new Error("thumbnail_ipc_metadata_invalid");
  return {
    cacheKey,
    bytes: bytes.slice(THUMBNAIL_IPC_HEADER_BYTES + cacheKeyBytes)
  };
}

export const fileWorkspaceApi: FileWorkspaceApi = {
  browseOpen: (request) => command("file_workspace_browse_open", request),
  browseRestore: (request) => command("file_workspace_browse_restore", request),
  browseStartEnumeration: (request) => command("file_workspace_browse_start_enumeration", request),
  browseNextPage: (request) => command("file_workspace_browse_next_page", request),
  browseCancel: (request) => command("file_workspace_browse_cancel_enumeration", request),
  browseReleasePage: (request) => command("file_workspace_browse_release_page", request),
  browseReleasePath: (request) => command("file_workspace_browse_release_path", request),
  browseRetainPath: (request) => command("file_workspace_browse_retain_path", request),
  browseDispose: (request) => command("file_workspace_browse_dispose", request),
  locationList: () => command("file_workspace_location_list"),
  changeStart: (request) => command("file_workspace_change_start", request),
  changePending: (request) => command("file_workspace_change_pending", request),
  changeRefresh: (request) => command("file_workspace_change_refresh", request),
  changeDispose: (request) => command("file_workspace_change_dispose", request),
  readEligibility: (request) => command("file_workspace_read_eligibility", request),
  thumbnailRequest: async (request) => decodeThumbnailIpcResponse(
    await command<ArrayBuffer>("file_workspace_thumbnail_request", request)
  ),
  thumbnailCancel: (request) => command("file_workspace_thumbnail_cancel", request),
  previewCreate: (request) => command("file_workspace_preview_create", request),
  previewSnapshot: (request) => command("file_workspace_preview_snapshot", request),
  previewStart: (request) => command("file_workspace_preview_start", request),
  previewCancel: (request) => command("file_workspace_preview_cancel", request),
  previewDispose: (request) => command("file_workspace_preview_dispose", request),
  previewSwitchSource: (request) => command("file_workspace_preview_switch_source", request)
};
