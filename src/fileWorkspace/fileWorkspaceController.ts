import type {
  BrowseNextPageRequest,
  BrowseOpenRequest,
  BrowseOpenResponse,
  BrowsePage,
  BrowsePathRef,
  BrowseRestoreRequest,
  BrowseStartEnumerationRequest,
  ChangePendingResponse,
  ChangeStartResponse,
  LocationDescriptor,
  NavigationTarget,
  PreviewCreateRequest,
  PreviewSnapshot,
  ReadEligibilityResponse,
  ThumbnailArtifact,
  ThumbnailRequest,
  WorkspaceRestoreLocator
} from "../types/fileWorkspace";
import { fileWorkspaceApi, type FileWorkspaceApi } from "../api/fileWorkspaceApi";
import {
  WorkspaceSession,
  type WorkspaceNavigationOptions,
  type WorkspaceRequestToken,
  type WorkspaceSessionSnapshot
} from "./workspaceSession";

export interface FileWorkspaceControllerState {
  session: WorkspaceSessionSnapshot;
  browse: BrowseOpenResponse | null;
  page: BrowsePage | null;
  change: ChangeStartResponse | null;
  pendingChange: ChangePendingResponse | null;
  locations: LocationDescriptor[];
  lastEligibility: ReadEligibilityResponse | null;
  previews: Record<string, PreviewSnapshot>;
}

export type FileWorkspaceStateListener = (state: FileWorkspaceControllerState) => void;

/**
 * Headless W1 coordinator. It owns renderer interaction state only; Browse,
 * Read Gate, Thumbnail and Preview remain backend/service authorities.
 */
export class FileWorkspaceController {
  readonly session: WorkspaceSession;
  private readonly api: FileWorkspaceApi;
  private listeners = new Set<FileWorkspaceStateListener>();
  private browseResponse: BrowseOpenResponse | null = null;
  private currentPage: BrowsePage | null = null;
  private changeResponse: ChangeStartResponse | null = null;
  private pendingChangeValue: ChangePendingResponse | null = null;
  private locationsValue: LocationDescriptor[] = [];
  private eligibilityValue: ReadEligibilityResponse | null = null;
  private previewsValue = new Map<string, PreviewSnapshot>();
  private activeThumbnailRequests = new Set<string>();

  constructor(api: FileWorkspaceApi = fileWorkspaceApi, session = new WorkspaceSession()) {
    this.api = api;
    this.session = session;
  }

  getState(): FileWorkspaceControllerState {
    return {
      session: this.session.getState(),
      browse: this.browseResponse,
      page: this.currentPage,
      change: this.changeResponse,
      pendingChange: this.pendingChangeValue,
      locations: [...this.locationsValue],
      lastEligibility: this.eligibilityValue,
      previews: Object.fromEntries(this.previewsValue.entries())
    };
  }

  subscribe(listener: FileWorkspaceStateListener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  async openBrowse(request: BrowseOpenRequest): Promise<BrowseOpenResponse | null> {
    const token = this.session.beginRequest();
    const response = await this.api.browseOpen(request);
    if (!this.session.canPublish(token)) {
      void this.api.browseDispose({ sessionId: response.sessionId });
      return null;
    }
    return this.publishBrowseAdmission(response, request, token);
  }

  async restoreBrowse(locator: WorkspaceRestoreLocator): Promise<BrowseOpenResponse | null> {
    if (locator.kind !== "browse") return null;
    const token = this.session.beginRequest();
    const request: BrowseRestoreRequest = { locator };
    const response = await this.api.browseRestore(request);
    if (!this.session.canPublish(token)) {
      void this.api.browseDispose({ sessionId: response.sessionId });
      return null;
    }
    return this.publishBrowseAdmission(
      response,
      {
        platform: locator.platform,
        routingHint: locator.routingHint,
        ...(locator.displayHint === undefined ? {} : { displayHint: locator.displayHint })
      },
      token
    );
  }

  navigate(target: NavigationTarget, options: WorkspaceNavigationOptions = {}) {
    const changed = this.session.navigate(target, options);
    if (changed) this.emit();
    return changed;
  }

  async startEnumeration(
    pathRef?: BrowsePathRef,
    requestId = `browse-${Date.now()}`,
    pageSize = 100
  ): Promise<BrowsePage | null> {
    const browseTarget = this.currentBrowseTarget();
    const token = this.session.beginRequest();
    if (browseTarget === null) return null;
    const request: BrowseStartEnumerationRequest = {
      sessionId: browseTarget.location.kind === "ephemeral"
        ? browseTarget.location.browseSessionId
        : "",
      requestId,
      pathRef: pathRef ?? browseTarget.pathRef,
      pageSize
    };
    const page = await this.api.browseStartEnumeration(request);
    if (!this.session.canPublish(token)) {
      void this.api.browseReleasePage({ page });
      return null;
    }
    this.publishPage(page);
    return page;
  }

  async nextPage(pageSize = 100): Promise<BrowsePage | null> {
    const browseTarget = this.currentBrowseTarget();
    const cursor = this.currentPage?.nextCursor;
    if (browseTarget === null || cursor === undefined) return null;
    const token = this.session.beginRequest();
    const request: BrowseNextPageRequest = {
      sessionId: browseTarget.location.kind === "ephemeral"
        ? browseTarget.location.browseSessionId
        : "",
      cursor,
      pageSize
    };
    const page = await this.api.browseNextPage(request);
    if (!this.session.canPublish(token)) {
      void this.api.browseReleasePage({ page });
      return null;
    }
    this.publishPage(page);
    return page;
  }

  async startChange(pathRef: BrowsePathRef): Promise<ChangeStartResponse | null> {
    const target = this.currentBrowseTarget();
    if (target === null || target.location.kind !== "ephemeral") return null;
    const token = this.session.beginRequest();
    const response = await this.api.changeStart({
      sessionId: target.location.browseSessionId,
      pathRef
    });
    if (!this.session.canPublish(token)) {
      void this.api.changeDispose({ monitorId: response.monitorId });
      return null;
    }
    this.changeResponse = response;
    this.pendingChangeValue = null;
    this.emit();
    return response;
  }

  async readPendingChange(): Promise<ChangePendingResponse | null> {
    if (this.changeResponse === null) return null;
    const token = this.session.beginRequest();
    const pending = await this.api.changePending({ monitorId: this.changeResponse.monitorId });
    if (!this.session.canPublish(token)) return null;
    this.pendingChangeValue = pending;
    this.emit();
    return pending;
  }

  async refreshChange(requestId = `refresh-${Date.now()}`, pageSize = 100): Promise<BrowsePage | null> {
    if (this.changeResponse === null) return null;
    const token = this.session.beginRequest();
    const page = await this.api.changeRefresh({
      monitorId: this.changeResponse.monitorId,
      requestId,
      pageSize
    });
    if (!this.session.canPublish(token)) {
      void this.api.browseReleasePage({ page });
      return null;
    }
    this.publishPage(page);
    this.pendingChangeValue = null;
    this.emit();
    return page;
  }

  async loadLocations(): Promise<LocationDescriptor[] | null> {
    const token = this.session.beginRequest();
    const locations = await this.api.locationList();
    if (!this.session.canPublish(token)) return null;
    this.locationsValue = locations;
    this.emit();
    return locations;
  }

  async readEligibility(source: ReadEligibilityResponse["source"]): Promise<ReadEligibilityResponse | null> {
    const token = this.session.beginRequest();
    const response = await this.api.readEligibility({ source });
    if (!this.session.canPublish(token)) return null;
    this.eligibilityValue = response;
    this.emit();
    return response;
  }

  async requestThumbnail(request: ThumbnailRequest): Promise<ThumbnailArtifact | null> {
    const token = this.session.beginRequest();
    this.activeThumbnailRequests.add(request.requestId);
    try {
      const artifact = await this.api.thumbnailRequest(request);
      if (!this.session.canPublish(token)) {
        void this.api.thumbnailCancel({ requestId: request.requestId });
        return null;
      }
      return artifact;
    } finally {
      this.activeThumbnailRequests.delete(request.requestId);
    }
  }

  async createPreview(request: PreviewCreateRequest): Promise<PreviewSnapshot | null> {
    const token = this.session.beginRequest();
    const snapshot = await this.api.previewCreate(request);
    if (!this.session.canPublish(token)) {
      void this.api.previewDispose({ previewId: snapshot.previewId });
      return null;
    }
    this.previewsValue.set(snapshot.previewId, snapshot);
    this.emit();
    return snapshot;
  }

  async startPreview(previewId: string): Promise<PreviewSnapshot | null> {
    const token = this.session.beginRequest();
    const snapshot = await this.api.previewStart({ previewId });
    if (!this.session.canPublish(token)) return null;
    this.previewsValue.set(previewId, snapshot);
    this.emit();
    return snapshot;
  }

  async dispose(): Promise<void> {
    if (!this.session.dispose()) return;
    const browseSessionId = this.browseResponse?.sessionId;
    const monitorId = this.changeResponse?.monitorId;
    const thumbnailRequests = [...this.activeThumbnailRequests];
    const previewIds = [...this.previewsValue.keys()];
    const operations: Promise<unknown>[] = thumbnailRequests.map((requestId) =>
      this.api.thumbnailCancel({ requestId })
    );
    if (monitorId !== undefined) operations.push(this.api.changeDispose({ monitorId }));
    operations.push(...previewIds.map((previewId) => this.api.previewDispose({ previewId })));
    if (browseSessionId !== undefined) operations.push(this.api.browseDispose({ sessionId: browseSessionId }));
    await Promise.allSettled(operations);
    this.browseResponse = null;
    this.currentPage = null;
    this.changeResponse = null;
    this.pendingChangeValue = null;
    this.previewsValue.clear();
    this.emit();
  }

  private async publishBrowseAdmission(
    response: BrowseOpenResponse,
    request: BrowseOpenRequest,
    token: WorkspaceRequestToken
  ) {
    const target: NavigationTarget = {
      kind: "browse",
      location: response.location.ref,
      pathRef: response.rootPathRef
    };
    const locator: WorkspaceRestoreLocator = {
      kind: "browse",
      platform: request.platform,
      routingHint: request.routingHint,
      ...(request.displayHint === undefined ? {} : { displayHint: request.displayHint })
    };
    if (!this.session.canPublish(token) || !this.session.navigate(target, { restoreLocator: locator })) {
      void this.api.browseDispose({ sessionId: response.sessionId });
      return null;
    }
    this.browseResponse = response;
    this.currentPage = null;
    this.changeResponse = null;
    this.pendingChangeValue = null;
    this.emit();
    return response;
  }

  private currentBrowseTarget() {
    const target = this.session.currentTarget;
    return target?.kind === "browse" ? target : null;
  }

  private publishPage(page: BrowsePage) {
    const oldPage = this.currentPage;
    this.currentPage = page;
    if (oldPage !== null && oldPage.enumerationId !== page.enumerationId) {
      void this.api.browseReleasePage({ page: oldPage });
    }
    this.emit();
  }

  private emit() {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}
