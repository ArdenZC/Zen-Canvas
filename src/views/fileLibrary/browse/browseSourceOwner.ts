import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Translator } from "../../../types/ui";
import type {
  BrowseEntry,
  BrowseEntryRef,
  BrowseOpenResponse,
  BrowsePage,
  BrowsePathRef,
  BrowseQueryEntryKind,
  BrowseQuerySpecV1,
  LocationAvailability,
  LocationDescriptor,
  LocationRef,
  NavigationTarget
} from "../../../types/fileWorkspace";
import type { FileLibraryExperienceController, FileLibraryExperienceState } from "../fileLibraryExperience";
import { adaptBrowseEntry, adaptBrowsePageCollection } from "../presentation/adapters";
import type {
  BrowsePresentationCollectionContext,
  BrowsePresentationEntry
} from "../presentation/contracts";

export const BROWSE_PAGE_SIZE = 32;

export type BrowseEnumerationState = "idle" | "loading" | "loading_more" | "partial" | "complete" | "failed";
export type BrowseLocationState = "idle" | "loading" | "ready" | "failed";
export type BrowseChangeState = "unavailable" | "starting" | "watching" | "checking" | "refreshing" | "failed";
export type BrowseSelectionIntent = "replace" | "toggle" | "range";

export interface BrowseBreadcrumb {
  readonly sessionId: string;
  readonly pathRef: BrowsePathRef;
  readonly label: string;
}

export interface BrowseSourceOwner {
  readonly locations: readonly LocationDescriptor[];
  readonly locationState: BrowseLocationState;
  readonly locationError: boolean;
  readonly admissionLoading: boolean;
  readonly enumerationState: BrowseEnumerationState;
  readonly enumerationError: boolean;
  readonly showLocationPicker: boolean;
  readonly browse: BrowseOpenResponse | null;
  readonly target: Extract<NavigationTarget, { kind: "browse" }> | null;
  readonly sessionId: string | null;
  readonly currentPathRef: BrowsePathRef | null;
  readonly breadcrumbs: readonly BrowseBreadcrumb[];
  readonly entries: readonly BrowsePresentationEntry[];
  readonly collection: BrowsePresentationCollectionContext | null;
  readonly query: BrowseQuerySpecV1;
  readonly queryText: string;
  readonly queryEntryKind: BrowseQueryEntryKind;
  readonly isQueryActive: boolean;
  readonly browseSortAvailable: false;
  readonly completion: BrowsePage["completion"] | null;
  readonly knownCount: number | null;
  readonly hasMore: boolean;
  readonly loadedCount: number;
  readonly selectedIds: ReadonlySet<string>;
  readonly selectedEntryRefs: readonly BrowseEntryRef[];
  readonly focusedId: string | null;
  readonly selectedCount: number;
  readonly pendingChange: FileLibraryExperienceState["workspace"]["pendingChange"];
  readonly canWatch: boolean;
  readonly changeState: BrowseChangeState;
  readonly changeError: boolean;
  readonly loadLocations: () => Promise<void>;
  readonly openLocationPicker: () => void;
  readonly activateLocation: (location: LocationDescriptor) => Promise<boolean>;
  readonly refreshEnumeration: () => Promise<void>;
  readonly loadNextPage: () => Promise<void>;
  readonly navigateInto: (entry: BrowsePresentationEntry) => boolean;
  readonly navigateToBreadcrumb: (breadcrumb: BrowseBreadcrumb) => boolean;
  readonly selectEntry: (entryId: string, intent: BrowseSelectionIntent) => void;
  readonly selectAllLoaded: () => void;
  readonly clearSelection: () => void;
  readonly setFocusedId: (entryId: string | null) => void;
  readonly setQueryText: (text: string) => void;
  readonly setQueryEntryKind: (kind: BrowseQueryEntryKind) => void;
}

type BrowseController = Pick<FileLibraryExperienceController, "browseLocation" | "navigate"> & {
  workspace: FileLibraryExperienceController["workspace"];
};

export function browseBreadcrumbKey(sessionId: string, pathRef: BrowsePathRef) {
  return `${sessionId}:${pathRef.id}`;
}

export function createBrowseBreadcrumb(
  sessionId: string,
  pathRef: BrowsePathRef,
  label: string
): BrowseBreadcrumb {
  return { sessionId, pathRef, label };
}

export function appendBrowseBreadcrumb(
  chain: readonly BrowseBreadcrumb[],
  breadcrumb: BrowseBreadcrumb
): BrowseBreadcrumb[] {
  const existingIndex = chain.findIndex((item) =>
    item.sessionId === breadcrumb.sessionId && item.pathRef.id === breadcrumb.pathRef.id
  );
  if (existingIndex >= 0) return [...chain.slice(0, existingIndex + 1)];
  return [...chain, breadcrumb];
}

export function browseBreadcrumbChainForPath(
  chains: ReadonlyMap<string, readonly BrowseBreadcrumb[]>,
  sessionId: string,
  pathRef: BrowsePathRef
) {
  const chain = chains.get(browseBreadcrumbKey(sessionId, pathRef));
  return chain === undefined ? null : [...chain];
}

export function browseEnumerationStateForPage(page: Pick<BrowsePage, "completion">) {
  return page.completion === "complete" ? "complete" : "partial";
}

export function useBrowseSourceOwner({
  controller,
  state,
  t
}: {
  controller: BrowseController;
  state: FileLibraryExperienceState;
  t: Translator;
}): BrowseSourceOwner {
  const locations = state.workspace.locations;
  const browse = state.workspace.browse;
  const currentTarget = state.workspace.session.currentTarget;
  const target = currentTarget?.kind === "browse" ? currentTarget : null;
  const sessionId = target?.location.kind === "ephemeral" ? target.location.browseSessionId : null;
  const currentPathRef = target?.pathRef ?? null;
  const targetKey = target === null
    ? null
    : `${sessionId ?? "managed"}:${target.pathRef.id}`;
  const canWatch = browse?.location.capabilities.canWatch === true;
  const [locationState, setLocationState] = useState<BrowseLocationState>("idle");
  const [locationError, setLocationError] = useState(false);
  const [admissionLoading, setAdmissionLoading] = useState(false);
  const [enumerationState, setEnumerationState] = useState<BrowseEnumerationState>("idle");
  const [enumerationError, setEnumerationError] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(target === null);
  const [activePage, setActivePage] = useState<BrowsePage | null>(null);
  const [entries, setEntries] = useState<BrowsePresentationEntry[]>([]);
  const [query, setQuery] = useState<BrowseQuerySpecV1>({ text: null, entryKind: "all" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [changeState, setChangeState] = useState<BrowseChangeState>("unavailable");
  const [changeError, setChangeError] = useState(false);
  const generationRef = useRef(0);
  const activeTargetKeyRef = useRef<string | null>(null);
  const [queryTargetKey, setQueryTargetKey] = useState<string | null>(null);
  const activeEnumerationKeyRef = useRef<string | null>(null);
  const activeChangeTargetKeyRef = useRef<string | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const locationLoadStartedRef = useRef(false);
  const breadcrumbChainsRef = useRef<Map<string, readonly BrowseBreadcrumb[]>>(new Map());
  const breadcrumbSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (breadcrumbSessionRef.current === sessionId) return;
    breadcrumbChainsRef.current.clear();
    breadcrumbSessionRef.current = sessionId;
  }, [sessionId]);

  const loadLocations = useCallback(async () => {
    setLocationState("loading");
    setLocationError(false);
    locationLoadStartedRef.current = true;
    try {
      const loaded = await controller.workspace.loadLocations();
      if (loaded === null) {
        setLocationState("failed");
        setLocationError(true);
        return;
      }
      setLocationState("ready");
    } catch {
      setLocationState("failed");
      setLocationError(true);
    }
  }, [controller.workspace]);

  useEffect(() => {
    if (state.mode !== "browse") return;
    if (locations.length > 0) {
      setLocationState((current) => current === "loading" ? current : "ready");
      return;
    }
    if (locationState === "idle" && !locationLoadStartedRef.current) void loadLocations();
  }, [loadLocations, locationState, locations.length, state.mode]);

  const openLocationPicker = useCallback(() => {
    setShowLocationPicker(true);
    if (locationState === "idle" && !locationLoadStartedRef.current) void loadLocations();
  }, [loadLocations, locationState]);

  const activateLocation = useCallback(async (location: LocationDescriptor) => {
    if (!isActivatableLocation(location)) return false;
    setAdmissionLoading(true);
    setLocationError(false);
    try {
      const response = await controller.browseLocation(location.ref);
      if (response === null) {
        setLocationError(true);
        return false;
      }
      setShowLocationPicker(false);
      return true;
    } catch {
      setLocationError(true);
      return false;
    } finally {
      setAdmissionLoading(false);
    }
  }, [controller]);

  const mergePage = useCallback((page: BrowsePage, generation: number, expectedTargetKey: string) => {
    if (generationRef.current !== generation || activeTargetKeyRef.current !== expectedTargetKey) return false;
    setActivePage(page);
    setEntries((current) => mergeBrowseEntries(current, page.entries));
    setEnumerationState(browseEnumerationStateForPage(page));
    setEnumerationError(false);
    return true;
  }, []);

  const prepareEnumerationPublication = useCallback(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setEnumerationState("loading");
    setEnumerationError(false);
    setActivePage(null);
    setEntries([]);
    setSelectedIds(new Set());
    setFocusedId(null);
    selectionAnchorRef.current = null;
    return generation;
  }, []);

  const beginEnumeration = useCallback(async (
    pathRef: BrowsePathRef,
    expectedTargetKey: string,
    expectedQuery: BrowseQuerySpecV1
  ) => {
    const generation = prepareEnumerationPublication();
    try {
      const page = await controller.workspace.startEnumeration(
        pathRef,
        `w2-04-${Date.now()}-${generation}`,
        BROWSE_PAGE_SIZE,
        expectedQuery
      );
      if (page === null) {
        if (generationRef.current === generation && activeTargetKeyRef.current === expectedTargetKey) {
          setEnumerationState("failed");
          setEnumerationError(true);
        }
        return;
      }
      mergePage(page, generation, expectedTargetKey);
    } catch {
      if (generationRef.current !== generation || activeTargetKeyRef.current !== expectedTargetKey) return;
      setEnumerationState("failed");
      setEnumerationError(true);
    }
  }, [controller.workspace, mergePage, prepareEnumerationPublication]);

  useEffect(() => {
    if (queryTargetKey === targetKey) return;
    setQueryTargetKey(targetKey);
    activeTargetKeyRef.current = targetKey;
    activeEnumerationKeyRef.current = null;
    setQuery({ text: null, entryKind: "all" });
    if (state.mode !== "browse" || targetKey === null || target === null || browse === null || sessionId === null) return;
    const rootBreadcrumb = createBrowseBreadcrumb(sessionId, browse.rootPathRef, browse.location.displayName);
    const rootKey = browseBreadcrumbKey(sessionId, browse.rootPathRef);
    if (!breadcrumbChainsRef.current.has(rootKey)) {
      breadcrumbChainsRef.current.set(rootKey, [rootBreadcrumb]);
    }
  }, [browse, queryTargetKey, sessionId, state.mode, target, targetKey]);

  useEffect(() => {
    if (state.mode !== "browse" || targetKey === null || target === null || browse === null || sessionId === null || currentPathRef === null) return;
    if (queryTargetKey !== targetKey) return;
    const enumerationKey = `${targetKey}:${JSON.stringify(query)}`;
    if (activeEnumerationKeyRef.current === enumerationKey) return;
    activeEnumerationKeyRef.current = enumerationKey;
    void beginEnumeration(currentPathRef, targetKey, query);
  }, [beginEnumeration, browse, currentPathRef, query, queryTargetKey, sessionId, state.mode, target, targetKey]);

  useEffect(() => {
    if (state.mode !== "browse" || targetKey === null || target === null || browse === null || sessionId === null || currentPathRef === null) {
      if (targetKey === null) {
        activeChangeTargetKeyRef.current = null;
        setChangeState("unavailable");
        setChangeError(false);
      }
      return;
    }
    if (activeChangeTargetKeyRef.current === targetKey) return;
    activeChangeTargetKeyRef.current = targetKey;
    setChangeError(false);
    if (!canWatch) {
      setChangeState("unavailable");
      return;
    }
    const existingChange = state.workspace.change;
    if (existingChange !== null
      && existingChange.sessionId === sessionId
      && existingChange.pathRef.id === currentPathRef.id) {
      setChangeState("watching");
      return;
    }
    setChangeState("starting");
    void controller.workspace.startChange(currentPathRef).then((response) => {
      if (activeChangeTargetKeyRef.current !== targetKey || activeTargetKeyRef.current !== targetKey) return;
      if (response === null) {
        setChangeState("failed");
        setChangeError(true);
        return;
      }
      setChangeState("watching");
    }).catch(() => {
      if (activeChangeTargetKeyRef.current !== targetKey || activeTargetKeyRef.current !== targetKey) return;
      setChangeState("failed");
      setChangeError(true);
    });
  }, [browse, canWatch, controller.workspace, currentPathRef, sessionId, state.mode, state.workspace.change, target, targetKey]);

  useEffect(() => {
    if (targetKey !== null) return;
    activeTargetKeyRef.current = null;
    activeEnumerationKeyRef.current = null;
    activeChangeTargetKeyRef.current = null;
    setChangeState("unavailable");
    setChangeError(false);
    setActivePage(null);
    setEntries([]);
    setSelectedIds(new Set());
    setFocusedId(null);
    setQuery({ text: null, entryKind: "all" });
    selectionAnchorRef.current = null;
    if (state.mode === "browse") setShowLocationPicker(true);
  }, [state.mode, targetKey]);

  const beginChangeRefresh = useCallback(async (
    expectedTargetKey: string,
    expectedQuery: BrowseQuerySpecV1
  ) => {
    const generation = prepareEnumerationPublication();
    setChangeState("refreshing");
    try {
      const page = await controller.workspace.refreshChange(
        `w2-04-change-refresh-${Date.now()}-${generation}`,
        BROWSE_PAGE_SIZE,
        expectedQuery
      );
      if (page === null) {
        if (generationRef.current === generation && activeTargetKeyRef.current === expectedTargetKey) {
          setEnumerationState("failed");
          setEnumerationError(true);
          setChangeState("failed");
          setChangeError(true);
        }
        return;
      }
      if (!mergePage(page, generation, expectedTargetKey)) return;
      setChangeState("watching");
    } catch {
      if (generationRef.current !== generation || activeTargetKeyRef.current !== expectedTargetKey) return;
      setEnumerationState("failed");
      setEnumerationError(true);
      setChangeState("failed");
      setChangeError(true);
    }
  }, [controller.workspace, mergePage, prepareEnumerationPublication]);

  const refreshEnumeration = useCallback(async () => {
    if (currentPathRef === null || targetKey === null) return;
    const expectedTargetKey = targetKey;
    const expectedPathRef = currentPathRef;
    const monitor = state.workspace.change;
    const monitorMatchesTarget = monitor !== null
      && sessionId !== null
      && monitor.sessionId === sessionId
      && monitor.pathRef.id === expectedPathRef.id;
    if (!monitorMatchesTarget) {
      if (!canWatch) setChangeState("unavailable");
      await beginEnumeration(expectedPathRef, expectedTargetKey, query);
      return;
    }

    setChangeState("checking");
    setChangeError(false);
    try {
      const pending = await controller.workspace.readPendingChange();
      if (activeTargetKeyRef.current !== expectedTargetKey) return;
      if (pending !== null) {
        await beginChangeRefresh(expectedTargetKey, query);
        return;
      }
      setChangeState("watching");
      await beginEnumeration(expectedPathRef, expectedTargetKey, query);
    } catch {
      if (activeTargetKeyRef.current !== expectedTargetKey) return;
      setChangeState("failed");
      setChangeError(true);
      await beginEnumeration(expectedPathRef, expectedTargetKey, query);
    }
  }, [beginChangeRefresh, beginEnumeration, canWatch, controller.workspace, currentPathRef, query, sessionId, state.workspace.change, targetKey]);

  const loadNextPage = useCallback(async () => {
    if (activePage?.nextCursor === undefined || enumerationState === "loading" || enumerationState === "loading_more") return;
    const generation = generationRef.current;
    const expectedTargetKey = targetKey;
    if (expectedTargetKey === null) return;
    setEnumerationState("loading_more");
    try {
      const page = await controller.workspace.nextPage(BROWSE_PAGE_SIZE);
      if (page === null) {
        if (generationRef.current === generation && activeTargetKeyRef.current === expectedTargetKey) {
          setEnumerationState("failed");
          setEnumerationError(true);
        }
        return;
      }
      if (generationRef.current !== generation || activeTargetKeyRef.current !== expectedTargetKey) return;
      if (activePage.enumerationId !== page.enumerationId || activePage.sessionId !== page.sessionId) return;
      mergePage(page, generation, expectedTargetKey);
    } catch {
      if (generationRef.current === generation && activeTargetKeyRef.current === expectedTargetKey) {
        setEnumerationState("failed");
        setEnumerationError(true);
      }
    }
  }, [activePage, controller.workspace, enumerationState, mergePage, targetKey]);

  const isQueryActive = (query.text?.trim().length ?? 0) > 0 || query.entryKind !== "all";
  useEffect(() => {
    const emptyPartialQuery = isQueryActive
      && enumerationState === "partial"
      && entries.length === 0
      && activePage?.nextCursor !== undefined;
    if (state.mode !== "browse" || !emptyPartialQuery) return;

    let timer: number | null = window.setTimeout(() => {
      timer = null;
      void loadNextPage();
    }, 0);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [activePage?.nextCursor, entries.length, enumerationState, isQueryActive, loadNextPage, state.mode]);

  const navigateInto = useCallback((entry: BrowsePresentationEntry) => {
    if (entry.entryKind !== "directory" || entry.pathRef === undefined || target === null || sessionId === null) return false;
    const currentPath = currentPathRef ?? browse?.rootPathRef;
    if (currentPath === undefined || browse === null) return false;
    const currentChain = browseBreadcrumbChainForPath(
      breadcrumbChainsRef.current,
      sessionId,
      currentPath
    ) ?? [createBrowseBreadcrumb(
      sessionId,
      currentPath,
      currentPath.id === browse.rootPathRef.id ? browse.location.displayName : t("browseCurrentFolder")
    )];
    const childBreadcrumb = createBrowseBreadcrumb(sessionId, entry.pathRef, entry.displayName);
    breadcrumbChainsRef.current.set(
      browseBreadcrumbKey(sessionId, entry.pathRef),
      appendBrowseBreadcrumb(currentChain, childBreadcrumb)
    );
    return controller.navigate({
      kind: "browse",
      location: target.location,
      pathRef: entry.pathRef
    });
  }, [browse, controller, currentPathRef, sessionId, t, target]);

  const breadcrumbs = useMemo(() => {
    if (target === null || sessionId === null || browse === null) return [];
    const projected = browseBreadcrumbChainForPath(
      breadcrumbChainsRef.current,
      sessionId,
      target.pathRef
    );
    if (projected !== null) return projected;
    return [createBrowseBreadcrumb(
      sessionId,
      target.pathRef,
      target.pathRef.id === browse.rootPathRef.id ? browse.location.displayName : t("browseCurrentFolder")
    )];
  }, [browse, sessionId, t, target]);

  const navigateToBreadcrumb = useCallback((breadcrumb: BrowseBreadcrumb) => {
    if (target === null || sessionId === null || breadcrumb.sessionId !== sessionId) return false;
    const chain = browseBreadcrumbChainForPath(
      breadcrumbChainsRef.current,
      sessionId,
      breadcrumb.pathRef
    );
    if (chain === null || !chain.some((item) =>
      item.sessionId === breadcrumb.sessionId && item.pathRef.id === breadcrumb.pathRef.id
    )) return false;
    breadcrumbChainsRef.current.set(
      browseBreadcrumbKey(sessionId, breadcrumb.pathRef),
      chain.slice(0, chain.findIndex((item) => item.pathRef.id === breadcrumb.pathRef.id) + 1)
    );
    return controller.navigate({ kind: "browse", location: target.location, pathRef: breadcrumb.pathRef });
  }, [controller, sessionId, target]);

  const selectEntry = useCallback((entryId: string, intent: BrowseSelectionIntent) => {
    const index = entries.findIndex((entry) => entry.entryRef.entryId === entryId);
    if (index < 0 || sessionId === null || entries[index].entryRef.browseSessionId !== sessionId) return;
    setSelectedIds((current) => {
      if (intent === "replace") return new Set([entryId]);
      if (intent === "toggle") {
        const next = new Set(current);
        if (next.has(entryId)) next.delete(entryId);
        else next.add(entryId);
        return next;
      }
      const anchor = selectionAnchorRef.current;
      const anchorIndex = anchor === null ? index : entries.findIndex((entry) => entry.entryRef.entryId === anchor);
      if (anchorIndex < 0) return new Set([entryId]);
      return new Set(entries.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1).map((entry) => entry.entryRef.entryId));
    });
    setFocusedId(entryId);
    if (intent !== "range") selectionAnchorRef.current = entryId;
  }, [entries, sessionId]);

  const selectAllLoaded = useCallback(() => {
    if (sessionId === null) return;
    const loaded = entries
      .filter((entry) => entry.entryRef.browseSessionId === sessionId)
      .map((entry) => entry.entryRef.entryId);
    setSelectedIds(new Set(loaded));
    setFocusedId(loaded[0] ?? null);
    selectionAnchorRef.current = loaded[0] ?? null;
  }, [entries, sessionId]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setFocusedId(null);
    selectionAnchorRef.current = null;
  }, []);

  const collection = useMemo(
    () => activePage === null ? null : adaptBrowsePageCollection(activePage),
    [activePage]
  );
  const selectedEntryRefs = useMemo(
    () => entries.filter((entry) => selectedIds.has(entry.entryRef.entryId)).map((entry) => entry.entryRef),
    [entries, selectedIds]
  );

  const setQueryText = useCallback((text: string) => {
    setQuery((current) => ({ ...current, text: text || null }));
  }, []);
  const setQueryEntryKind = useCallback((entryKind: BrowseQueryEntryKind) => {
    setQuery((current) => ({ ...current, entryKind }));
  }, []);

  return {
    locations,
    locationState,
    locationError,
    admissionLoading,
    enumerationState,
    enumerationError,
    showLocationPicker: showLocationPicker || target === null,
    browse,
    target,
    sessionId,
    currentPathRef,
    breadcrumbs,
    entries,
    collection,
    query,
    queryText: query.text ?? "",
    queryEntryKind: query.entryKind,
    isQueryActive,
    browseSortAvailable: false,
    completion: activePage?.completion ?? null,
    knownCount: activePage?.completion === "complete" && typeof activePage.knownCount === "number" ? activePage.knownCount : null,
    hasMore: activePage?.nextCursor !== undefined,
    loadedCount: entries.length,
    selectedIds,
    selectedEntryRefs,
    focusedId,
    selectedCount: selectedIds.size,
    pendingChange: state.workspace.pendingChange,
    canWatch,
    changeState,
    changeError,
    loadLocations,
    openLocationPicker,
    activateLocation,
    refreshEnumeration,
    loadNextPage,
    navigateInto,
    navigateToBreadcrumb,
    selectEntry,
    selectAllLoaded,
    clearSelection,
    setFocusedId,
    setQueryText,
    setQueryEntryKind
  } satisfies BrowseSourceOwner;
}

export function mergeBrowseEntries(
  current: readonly BrowsePresentationEntry[],
  incoming: readonly BrowseEntry[]
): BrowsePresentationEntry[] {
  const seen = new Set(current.map((entry) => `${entry.entryRef.browseSessionId}:${entry.entryRef.entryId}`));
  const next = [...current];
  for (const entry of incoming) {
    const key = `${entry.ref.browseSessionId}:${entry.ref.entryId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(adaptBrowseEntry(entry));
  }
  return next;
}

export function isActivatableLocation(location: LocationDescriptor) {
  return location.availability === "available" && location.capabilities.canBrowse;
}

export function locationAvailabilityLabel(availability: LocationAvailability, t: Translator) {
  switch (availability) {
    case "available": return t("browseLocationReady");
    case "permission_denied": return t("browseLocationPermission");
    case "offline": return t("browseLocationOffline");
    case "disconnected": return t("browseLocationDisconnected");
    case "authentication_required": return t("browseLocationAuthentication");
    case "not_found": return t("browseLocationNotFound");
    case "unknown": return t("browseLocationUnknown");
    default: return t("browseLocationUnavailable");
  }
}

export function locationRefSessionId(ref: LocationRef) {
  return ref.kind === "ephemeral" ? ref.browseSessionId : null;
}
