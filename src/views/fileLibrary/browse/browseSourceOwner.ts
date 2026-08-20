import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Translator } from "../../../types/ui";
import type {
  BrowseEntry,
  BrowseEntryRef,
  BrowseOpenResponse,
  BrowsePage,
  BrowsePathRef,
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
}

type BrowseController = Pick<FileLibraryExperienceController, "browseLocation" | "navigate"> & {
  workspace: FileLibraryExperienceController["workspace"];
};

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
  const [locationState, setLocationState] = useState<BrowseLocationState>("idle");
  const [locationError, setLocationError] = useState(false);
  const [admissionLoading, setAdmissionLoading] = useState(false);
  const [enumerationState, setEnumerationState] = useState<BrowseEnumerationState>("idle");
  const [enumerationError, setEnumerationError] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(target === null);
  const [activePage, setActivePage] = useState<BrowsePage | null>(null);
  const [entries, setEntries] = useState<BrowsePresentationEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const generationRef = useRef(0);
  const activeTargetKeyRef = useRef<string | null>(null);
  const selectionAnchorRef = useRef<string | null>(null);
  const locationLoadStartedRef = useRef(false);
  const pathLabelsRef = useRef<Map<string, string>>(new Map());
  const pathLabelSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathLabelSessionRef.current === sessionId) return;
    pathLabelsRef.current.clear();
    pathLabelSessionRef.current = sessionId;
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
    setEnumerationState(page.nextCursor === undefined ? "complete" : "partial");
    setEnumerationError(false);
    return true;
  }, []);

  const beginEnumeration = useCallback(async (pathRef: BrowsePathRef, expectedTargetKey: string) => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setEnumerationState("loading");
    setEnumerationError(false);
    setActivePage(null);
    setEntries([]);
    setSelectedIds(new Set());
    setFocusedId(null);
    selectionAnchorRef.current = null;
    try {
      const page = await controller.workspace.startEnumeration(
        pathRef,
        `w2-04-${Date.now()}-${generation}`,
        BROWSE_PAGE_SIZE
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
  }, [controller.workspace, mergePage]);

  useEffect(() => {
    if (state.mode !== "browse" || targetKey === null || target === null || browse === null || sessionId === null) return;
    if (activeTargetKeyRef.current === targetKey) return;
    activeTargetKeyRef.current = targetKey;
    if (currentPathRef !== null && !pathLabelsRef.current.has(currentPathRef.id)) {
      pathLabelsRef.current.set(currentPathRef.id, t("browseCurrentFolder"));
    }
    void beginEnumeration(currentPathRef ?? browse.rootPathRef, targetKey);
  }, [beginEnumeration, browse, currentPathRef, sessionId, state.mode, t, target, targetKey]);

  useEffect(() => {
    if (targetKey !== null) return;
    activeTargetKeyRef.current = null;
    setActivePage(null);
    setEntries([]);
    setSelectedIds(new Set());
    setFocusedId(null);
    selectionAnchorRef.current = null;
    if (state.mode === "browse") setShowLocationPicker(true);
  }, [state.mode, targetKey]);

  const refreshEnumeration = useCallback(async () => {
    if (currentPathRef === null || targetKey === null) return;
    await beginEnumeration(currentPathRef, targetKey);
  }, [beginEnumeration, currentPathRef, targetKey]);

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

  const navigateInto = useCallback((entry: BrowsePresentationEntry) => {
    if (entry.entryKind !== "directory" || entry.pathRef === undefined || target === null || sessionId === null) return false;
    pathLabelsRef.current.set(entry.pathRef.id, entry.displayName);
    return controller.navigate({
      kind: "browse",
      location: target.location,
      pathRef: entry.pathRef
    });
  }, [controller, sessionId, target]);

  const breadcrumbs = useMemo(() => {
    if (target === null || sessionId === null || browse === null) return [];
    const history = state.workspace.session.history.slice(0, state.workspace.session.historyIndex + 1);
    const seen = new Set<string>();
    const result: BrowseBreadcrumb[] = [];
    for (const historyTarget of history) {
      if (historyTarget.kind !== "browse" || historyTarget.location.kind !== "ephemeral" || historyTarget.location.browseSessionId !== sessionId) continue;
      if (seen.has(historyTarget.pathRef.id)) continue;
      seen.add(historyTarget.pathRef.id);
      result.push({
        sessionId,
        pathRef: historyTarget.pathRef,
        label: pathLabelsRef.current.get(historyTarget.pathRef.id)
          ?? (historyTarget.pathRef.id === browse.rootPathRef.id ? browse.location.displayName : t("browseFolder"))
      });
    }
    if (!seen.has(target.pathRef.id)) {
      result.push({
        sessionId,
        pathRef: target.pathRef,
        label: pathLabelsRef.current.get(target.pathRef.id) ?? t("browseCurrentFolder")
      });
    }
    return result;
  }, [browse, sessionId, state.workspace.session.history, state.workspace.session.historyIndex, t, target]);

  const navigateToBreadcrumb = useCallback((breadcrumb: BrowseBreadcrumb) => {
    if (target === null || sessionId === null || breadcrumb.sessionId !== sessionId) return false;
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
    selectionAnchorRef.current = entryId;
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
  const canWatch = browse?.location.capabilities.canWatch === true;

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
    setFocusedId
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
