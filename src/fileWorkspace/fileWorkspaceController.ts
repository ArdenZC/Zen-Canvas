import type {
  BrowseEnumerationRef,
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

interface OwnedBrowseSession {
  response: BrowseOpenResponse;
  locator: WorkspaceRestoreLocator;
  pages: Map<string, BrowsePage>;
  pathRefs: Map<string, BrowsePathRef>;
  enumerations: Map<string, BrowseEnumerationRef>;
}

interface PendingEnumeration {
  sessionId: string;
  requestId: string;
  enumeration?: BrowseEnumerationRef;
}

/**
 * Headless W1 coordinator. WorkspaceSession owns publication epochs and
 * history metadata. This controller owns only live backend lifecycle handles;
 * switched Browse sessions are disposed, and Back/Forward re-resolves their
 * non-authoritative locator into fresh ephemeral refs.
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

  // These registries are controller ownership, not new product authorities.
  // WorkspaceSession history retains restore locators; these maps retain only
  // live command-addressable disposable work.
  private ownedBrowseSessions = new Map<string, OwnedBrowseSession>();
  private ownedMonitors = new Map<string, string>();
  private pendingEnumerations = new Map<string, PendingEnumeration>();
  private activeThumbnailRequests = new Set<string>();
  private ownedPreviewIds = new Set<string>();
  private pendingCleanup = new Set<Promise<unknown>>();

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
      this.trackCleanup(this.cleanupCall(() => this.api.browseDispose({ sessionId: response.sessionId })));
      return null;
    }
    return this.publishBrowseAdmission(response, request, token, false);
  }

  async restoreBrowse(locator: WorkspaceRestoreLocator): Promise<BrowseOpenResponse | null> {
    if (locator.kind !== "browse") return null;
    const token = this.session.beginRequest();
    const request: BrowseRestoreRequest = { locator };
    const response = await this.api.browseRestore(request);
    if (!this.session.canPublish(token)) {
      this.trackCleanup(this.cleanupCall(() => this.api.browseDispose({ sessionId: response.sessionId })));
      return null;
    }
    return this.publishBrowseAdmission(
      response,
      {
        platform: locator.platform,
        routingHint: locator.routingHint,
        ...(locator.displayHint === undefined ? {} : { displayHint: locator.displayHint })
      },
      token,
      false
    );
  }

  navigate(target: NavigationTarget, options: WorkspaceNavigationOptions = {}) {
    const previousEpoch = this.session.requestEpoch;
    const changed = this.session.navigate(target, options);
    const switched = this.session.requestEpoch !== previousEpoch;
    if (switched) {
      void this.revokeAllOwnedResources();
      this.clearPublishedState();
      this.emit();
    } else if (changed) {
      this.emit();
    }
    return changed;
  }

  async back(): Promise<BrowseOpenResponse | null> {
    if (!this.session.back()) return null;
    const cleanup = this.revokeAllOwnedResources();
    this.clearPublishedState();
    this.emit();
    await cleanup;
    return this.restoreCurrentHistoryBrowse();
  }

  async forward(): Promise<BrowseOpenResponse | null> {
    if (!this.session.forward()) return null;
    const cleanup = this.revokeAllOwnedResources();
    this.clearPublishedState();
    this.emit();
    await cleanup;
    return this.restoreCurrentHistoryBrowse();
  }

  async startEnumeration(
    pathRef?: BrowsePathRef,
    requestId = `browse-${Date.now()}`,
    pageSize = 100
  ): Promise<BrowsePage | null> {
    const browseTarget = this.currentBrowseTarget();
    const token = this.session.beginRequest();
    if (browseTarget === null) return null;
    const sessionId = browseTarget.location.kind === "ephemeral"
      ? browseTarget.location.browseSessionId
      : "";
    const owner = this.ownedBrowseSessions.get(sessionId);
    if (owner === undefined) return null;
    const requestedPathRef = pathRef ?? browseTarget.pathRef;
    owner.pathRefs.set(requestedPathRef.id, requestedPathRef);
    const pending: PendingEnumeration = { sessionId, requestId };
    const pendingKey = `start:${sessionId}:${requestId}`;
    this.pendingEnumerations.set(pendingKey, pending);
    const request: BrowseStartEnumerationRequest = {
      sessionId,
      requestId,
      pathRef: requestedPathRef,
      pageSize
    };
    try {
      const page = await this.api.browseStartEnumeration(request);
      if (!this.session.canPublish(token)) {
        this.releasePageLater(page);
        return null;
      }
      pending.enumeration = enumerationForPage(page);
      this.publishPage(page);
      return page;
    } finally {
      this.pendingEnumerations.delete(pendingKey);
    }
  }

  async nextPage(pageSize = 100): Promise<BrowsePage | null> {
    const browseTarget = this.currentBrowseTarget();
    const currentPage = this.currentPage;
    if (browseTarget === null || currentPage?.nextCursor === undefined) return null;
    const sessionId = browseTarget.location.kind === "ephemeral"
      ? browseTarget.location.browseSessionId
      : "";
    const owner = this.ownedBrowseSessions.get(sessionId);
    if (owner === undefined) return null;
    const enumeration = owner.enumerations.get(currentPage.enumerationId);
    if (enumeration === undefined) return null;
    const token = this.session.beginRequest();
    const pending: PendingEnumeration = {
      sessionId,
      requestId: enumeration.requestId,
      enumeration
    };
    const pendingKey = `next:${sessionId}:${enumeration.enumerationId}:${token.epoch}`;
    this.pendingEnumerations.set(pendingKey, pending);
    const request: BrowseNextPageRequest = {
      sessionId,
      cursor: currentPage.nextCursor,
      pageSize
    };
    try {
      const page = await this.api.browseNextPage(request);
      if (!this.session.canPublish(token)) {
        this.releasePageLater(page);
        return null;
      }
      this.publishPage(page);
      return page;
    } finally {
      this.pendingEnumerations.delete(pendingKey);
    }
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
      this.trackCleanup(this.cleanupCall(() => this.api.changeDispose({ monitorId: response.monitorId })));
      return null;
    }
    const owner = this.ownedBrowseSessions.get(response.sessionId);
    if (owner === undefined) {
      this.trackCleanup(this.cleanupCall(() => this.api.changeDispose({ monitorId: response.monitorId })));
      return null;
    }
    owner.pathRefs.set(pathRef.id, pathRef);
    this.ownedMonitors.set(response.monitorId, response.sessionId);
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
    const monitorId = this.changeResponse.monitorId;
    const sessionId = this.ownedMonitors.get(monitorId);
    if (sessionId === undefined) return null;
    const token = this.session.beginRequest();
    const pendingKey = `refresh:${sessionId}:${requestId}`;
    this.pendingEnumerations.set(pendingKey, { sessionId, requestId });
    try {
      const page = await this.api.changeRefresh({ monitorId, requestId, pageSize });
      if (!this.session.canPublish(token)) {
        this.releasePageLater(page);
        return null;
      }
      this.publishPage(page);
      this.pendingChangeValue = null;
      this.emit();
      return page;
    } finally {
      this.pendingEnumerations.delete(pendingKey);
    }
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
        this.trackCleanup(this.cleanupCall(() => this.api.thumbnailCancel({ requestId: request.requestId })));
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
      this.trackCleanup(this.cleanupCall(() => this.api.previewDispose({ previewId: snapshot.previewId })));
      return null;
    }
    this.ownedPreviewIds.add(snapshot.previewId);
    this.previewsValue.set(snapshot.previewId, snapshot);
    this.emit();
    return snapshot;
  }

  async startPreview(previewId: string): Promise<PreviewSnapshot | null> {
    const token = this.session.beginRequest();
    this.ownedPreviewIds.add(previewId);
    try {
      const snapshot = await this.api.previewStart({ previewId });
      if (!this.session.canPublish(token)) {
        this.disposePreviewLater(previewId);
        return null;
      }
      this.previewsValue.set(previewId, snapshot);
      this.emit();
      return snapshot;
    } catch (error) {
      if (!this.session.canPublish(token)) this.disposePreviewLater(previewId);
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (!this.session.dispose()) return;
    const cleanup = this.revokeAllOwnedResources();
    const pending = [...this.pendingCleanup];
    await Promise.allSettled([cleanup, ...pending]);
    this.clearPublishedState();
    this.emit();
  }

  private async restoreCurrentHistoryBrowse(): Promise<BrowseOpenResponse | null> {
    const target = this.session.currentTarget;
    const locator = this.session.serializeRestoreLocator();
    if (target?.kind !== "browse" || locator?.kind !== "browse") return null;
    const token = this.session.beginRequest();
    const response = await this.api.browseRestore({ locator });
    if (!this.session.canPublish(token)) {
      this.trackCleanup(this.cleanupCall(() => this.api.browseDispose({ sessionId: response.sessionId })));
      return null;
    }
    return this.publishBrowseAdmission(response, {
      platform: locator.platform,
      routingHint: locator.routingHint,
      ...(locator.displayHint === undefined ? {} : { displayHint: locator.displayHint })
    }, token, true);
  }

  private async publishBrowseAdmission(
    response: BrowseOpenResponse,
    request: BrowseOpenRequest,
    token: WorkspaceRequestToken,
    replaceHistorySlot: boolean
  ): Promise<BrowseOpenResponse | null> {
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
    if (!this.session.canPublish(token)) {
      this.trackCleanup(this.cleanupCall(() => this.api.browseDispose({ sessionId: response.sessionId })));
      return null;
    }
    const previousEpoch = this.session.requestEpoch;
    const rebound = replaceHistorySlot
      ? this.session.replaceCurrentTarget(target, { restoreLocator: locator })
      : this.session.navigate(target, { restoreLocator: locator });
    if (!rebound) {
      this.trackCleanup(this.cleanupCall(() => this.api.browseDispose({ sessionId: response.sessionId })));
      return null;
    }
    const admissionEpoch = this.session.requestEpoch;

    const cleanup = admissionEpoch === previousEpoch
      ? Promise.resolve()
      : this.revokeAllOwnedResources();
    this.clearPublishedState();
    await cleanup;
    if (!this.session.isEpochCurrent(admissionEpoch)) {
      this.trackCleanup(this.cleanupCall(() => this.api.browseDispose({ sessionId: response.sessionId })));
      return null;
    }

    const owner: OwnedBrowseSession = {
      response,
      locator,
      pages: new Map(),
      pathRefs: new Map([[response.rootPathRef.id, response.rootPathRef]]),
      enumerations: new Map()
    };
    this.ownedBrowseSessions.set(response.sessionId, owner);
    this.browseResponse = response;
    this.emit();
    return response;
  }

  private currentBrowseTarget() {
    const target = this.session.currentTarget;
    return target?.kind === "browse" ? target : null;
  }

  private publishPage(page: BrowsePage) {
    const owner = this.ownedBrowseSessions.get(page.sessionId);
    if (owner === undefined) {
      this.releasePageLater(page);
      return;
    }
    const oldPage = this.currentPage;
    // A next-page response normally keeps the same enumeration/request IDs,
    // but it is still a distinct backend-owned page handle. Release by object
    // identity so pagination cannot silently leak the previous page.
    if (oldPage !== null && oldPage !== page) {
      const oldOwner = this.ownedBrowseSessions.get(oldPage.sessionId);
      oldOwner?.pages.delete(pageKey(oldPage));
      this.releasePageLater(oldPage);
    }
    owner.pages.set(pageKey(page), page);
    owner.enumerations.set(page.enumerationId, enumerationForPage(page));
    for (const entry of page.entries) {
      if (entry.pathRef !== undefined) owner.pathRefs.set(entry.pathRef.id, entry.pathRef);
    }
    this.currentPage = page;
    this.emit();
  }

  private releasePageLater(page: BrowsePage) {
    this.trackCleanup(this.cleanupCall(() => this.api.browseReleasePage({ page })));
  }

  private disposePreviewLater(previewId: string) {
    this.trackCleanup(this.cleanupCall(async () => {
      try {
        await this.api.previewCancel({ previewId });
      } finally {
        await this.api.previewDispose({ previewId });
      }
    }));
  }

  private revokeAllOwnedResources(): Promise<unknown> {
    const browseOwners = [...this.ownedBrowseSessions.values()];
    this.ownedBrowseSessions.clear();
    const pendingEnumerations = [...this.pendingEnumerations.values()];
    this.pendingEnumerations.clear();
    const monitorIds = [...this.ownedMonitors.keys()];
    this.ownedMonitors.clear();
    const thumbnailIds = [...this.activeThumbnailRequests];
    this.activeThumbnailRequests.clear();
    const previewIds = [...this.ownedPreviewIds];
    this.ownedPreviewIds.clear();

    const enumerationCalls = new Map<string, () => Promise<unknown>>();
    for (const pending of pendingEnumerations) {
      const key = pending.enumeration === undefined
        ? `request:${pending.sessionId}:${pending.requestId}`
        : `enumeration:${pending.enumeration.enumerationId}`;
      enumerationCalls.set(key, () => this.api.browseCancel(
        pending.enumeration === undefined
          ? { sessionId: pending.sessionId, requestId: pending.requestId }
          : { sessionId: pending.sessionId, enumeration: pending.enumeration }
      ));
    }
    const pageCalls: Array<() => Promise<unknown>> = [];
    const pathCalls: Array<() => Promise<unknown>> = [];
    const browseDisposeCalls: Array<() => Promise<unknown>> = [];
    for (const owner of browseOwners) {
      for (const enumeration of owner.enumerations.values()) {
        enumerationCalls.set(`enumeration:${enumeration.enumerationId}`, () => this.api.browseCancel({
          sessionId: owner.response.sessionId,
          enumeration
        }));
      }
      for (const page of owner.pages.values()) {
        pageCalls.push(() => this.api.browseReleasePage({ page }));
      }
      for (const pathRef of owner.pathRefs.values()) {
        pathCalls.push(() => this.api.browseReleasePath({
          sessionId: owner.response.sessionId,
          pathRef
        }));
      }
      browseDisposeCalls.push(() => this.api.browseDispose({ sessionId: owner.response.sessionId }));
    }

    const cleanup = (async () => {
      await Promise.all([...enumerationCalls.values()].map((call) => this.cleanupCall(call)));
      await Promise.all(pageCalls.map((call) => this.cleanupCall(call)));
      await Promise.all(pathCalls.map((call) => this.cleanupCall(call)));
      await Promise.all(monitorIds.map((monitorId) => this.cleanupCall(
        () => this.api.changeDispose({ monitorId })
      )));
      await Promise.all(thumbnailIds.map((requestId) => this.cleanupCall(
        () => this.api.thumbnailCancel({ requestId })
      )));
      await Promise.all(previewIds.map((previewId) => this.cleanupCall(
        () => this.api.previewCancel({ previewId })
      )));
      await Promise.all(previewIds.map((previewId) => this.cleanupCall(
        () => this.api.previewDispose({ previewId })
      )));
      await Promise.all(browseDisposeCalls.map((call) => this.cleanupCall(call)));
    })();
    return this.trackCleanup(cleanup);
  }

  private clearPublishedState() {
    this.browseResponse = null;
    this.currentPage = null;
    this.changeResponse = null;
    this.pendingChangeValue = null;
    this.eligibilityValue = null;
    this.previewsValue.clear();
  }

  private trackCleanup(operation: Promise<unknown>): Promise<unknown> {
    const tracked = operation.catch(() => undefined);
    this.pendingCleanup.add(tracked);
    void tracked.then(() => this.pendingCleanup.delete(tracked));
    return tracked;
  }

  private cleanupCall(call: () => Promise<unknown>): Promise<unknown> {
    return Promise.resolve().then(call).catch(() => undefined);
  }

  private emit() {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }
}

function pageKey(page: BrowsePage) {
  return `${page.enumerationId}:${page.requestId}`;
}

function enumerationForPage(page: BrowsePage): BrowseEnumerationRef {
  return {
    sessionId: page.sessionId,
    requestId: page.requestId,
    enumerationId: page.enumerationId
  };
}
