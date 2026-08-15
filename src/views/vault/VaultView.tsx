import { Bookmark, ChevronDown, FolderSearch, Layers, SlidersHorizontal, Tag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { tauriApi } from "../../api/tauriApi";
import { useI18nContext, useNavigationContext, useRuntimeCapabilitiesContext } from "../../contexts/AppContexts";
import { useFileLibraryStore } from "../../store/useFileLibraryStore";
import {
  cloneFileQuerySpec,
  selectionContainsFileId,
  selectedLoadedIds,
  useFileLibraryInspectorStore,
  useFileLibraryQueryStore,
  useFileLibraryResultStore,
  useFileLibrarySavedViewStore,
  useFileLibrarySelectionStore,
  useFileLibraryTagStore,
  type InspectorDetailLoadResult
} from "../../store/useFileLibraryV2Store";
import { useScanManagerStore } from "../../store/useScanManagerStore";
import { useOperationQueueStore } from "../../store/useOperationQueueStore";
import type { FileLibraryDetail, FileLibrarySummary, FileQueryFiltersV2, FileQuerySpecV2, LibrarySavedView, OperationPreview } from "../../types/domain";
import { libraryScopeLabel, readableError } from "../../utils/viewHelpers";
import { buttonGhost, buttonSecondary, buttonSubtle, cn, glassButtonPrimary, raisedSurface } from "../../utils/tw";
import { InspectorLayout, MetricStrip, NoticeBanner, SearchField, StateBlock, pageFrame } from "../shared/ui";
import { FileLibraryFilterPopover } from "./components/FileLibraryFilterPopover";
import { FileLibraryInspector, FileLibraryPreviewDialog, libraryRevealLabel } from "./components/FileLibraryInspector";
import { ContentUnderstandingSheet, type ContentRefreshResult } from "./components/ContentUnderstandingSheet";
import { FileLibraryList } from "./components/FileLibraryList";
import { LibraryMetadataManagerDialog } from "./components/LibraryMetadataManagerDialog";
import { DuplicateGroupsPanel } from "./components/DuplicateGroupsPanel";
import { useVaultQueryController } from "./controllers/useVaultQueryController";

type ContextMenuCloseReason = "escape" | "outside-pointer" | "action" | "dialog-handoff";
type ContextMenuState = { file: FileLibrarySummary; x: number; y: number; restoreFocusElement: HTMLElement | null };

export function VaultView() {
  const { t, language } = useI18nContext();
  const { onError, setView } = useNavigationContext();
  const { capabilities } = useRuntimeCapabilitiesContext();
  const legacyScope = useFileLibraryStore((state) => state.scope);
  const stats = useFileLibraryStore((state) => state.stats);
  const setLegacyScope = useFileLibraryStore((state) => state.setScope);
  const handleChooseFolders = useScanManagerStore((state) => state.handleChooseFolders);
  const querySpec = useFileLibraryQueryStore((state) => state.spec);
  const setQuerySpec = useFileLibraryQueryStore((state) => state.setSpec);
  const scopeHealth = useFileLibraryQueryStore((state) => state.scopeHealth);
  const files = useFileLibraryResultStore((state) => state.files);
  const totalCount = useFileLibraryResultStore((state) => state.totalCount);
  const isCountLoading = useFileLibraryResultStore((state) => state.isCountLoading);
  const hasMore = useFileLibraryResultStore((state) => state.hasMore);
  const isLoading = useFileLibraryResultStore((state) => state.isLoading);
  const resultState = useFileLibraryResultStore((state) => state.resultState);
  const resultError = useFileLibraryResultStore((state) => state.error);
  const loadFirstPage = useFileLibraryResultStore((state) => state.loadFirstPage);
  const loadNextPage = useFileLibraryResultStore((state) => state.loadNextPage);
  const refreshResults = useFileLibraryResultStore((state) => state.refresh);
  const clearResults = useFileLibraryResultStore((state) => state.clear);
  const selection = useFileLibrarySelectionStore((state) => state.selection);
  const focusedId = useFileLibrarySelectionStore((state) => state.focusedId);
  const setExplicitSelection = useFileLibrarySelectionStore((state) => state.setExplicit);
  const toggleSelection = useFileLibrarySelectionStore((state) => state.toggle);
  const selectAllMatching = useFileLibrarySelectionStore((state) => state.selectAllMatching);
  const clearSelection = useFileLibrarySelectionStore((state) => state.clear);
  const detail = useFileLibraryInspectorStore((state) => state.detail);
  const selectionSummary = useFileLibraryInspectorStore((state) => state.selectionSummary);
  const isInspectorLoading = useFileLibraryInspectorStore((state) => state.isLoading);
  const inspectorError = useFileLibraryInspectorStore((state) => state.error);
  const loadDetail = useFileLibraryInspectorStore((state) => state.loadDetail);
  const commitDetailIfCurrent = useFileLibraryInspectorStore((state) => state.commitDetailIfCurrent);
  const loadSelectionSummary = useFileLibraryInspectorStore((state) => state.loadSelectionSummary);
  const clearInspector = useFileLibraryInspectorStore((state) => state.clear);
  const clearExecutionIntent = useOperationQueueStore((state) => state.clearExecutionIntent);
  const refreshPreviewsForFiles = useOperationQueueStore((state) => state.refreshPreviewsForFiles);
  const refreshPreviewsForSelection = useOperationQueueStore((state) => state.refreshPreviewsForSelection);
  const setPreviewResult = useOperationQueueStore((state) => state.setPreviewResult);
  const tags = useFileLibraryTagStore((state) => state.tags);
  const loadTags = useFileLibraryTagStore((state) => state.load);
  const mutateTags = useFileLibraryTagStore((state) => state.mutate);
  const savedViews = useFileLibrarySavedViewStore((state) => state.views);
  const activeViewId = useFileLibrarySavedViewStore((state) => state.activeViewId);
  const loadSavedViews = useFileLibrarySavedViewStore((state) => state.load);
  const setActiveViewId = useFileLibrarySavedViewStore((state) => state.setActiveViewId);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [metadataManager, setMetadataManager] = useState<"tags" | "saved_views" | null>(null);
  const [previewFile, setPreviewFile] = useState<FileLibraryDetail | null>(null);
  const [contentDetail, setContentDetail] = useState<FileLibraryDetail | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewTriggerRef = useRef<HTMLElement | null>(null);
  const previewOpenEpoch = useRef(0);
  const contentTriggerRef = useRef<HTMLElement | null>(null);
  const contentRestoreTargetRef = useRef<HTMLElement | null>(null);
  const contentOpenEpoch = useRef(0);
  const pendingContentOpenRef = useRef<{ epoch: number; fileId: string } | null>(null);
  const contentRefreshEpoch = useRef(0);
  const contentDetailRef = useRef<FileLibraryDetail | null>(null);
  const handleQueryError = useCallback((error: unknown) => onError(readableError(error)), [onError]);
  const {
    librarySearch,
    debouncedSearchQuery,
    scopeReady,
    isEmptyCurrentScanScope,
    querySpecSignature,
    updateFilters,
    clearFilters,
    setSort,
    applySavedView,
    handleLibrarySearchChange
  } = useVaultQueryController({
    legacyScope,
    querySpec,
    setQuerySpec,
    loadFirstPage,
    clearResults,
    onError: handleQueryError,
    savedViews,
    activeViewId,
    setActiveViewId,
    clearSelection
  });
  const selectedIds = useMemo(() => selectedLoadedIds(files, selection), [files, selection]);
  const selectedIdList = useMemo(() => [...selectedIds], [selectedIds]);
  const selectedFiles = useMemo(() => files.filter((file) => selectedIds.has(file.id)), [files, selectedIds]);
  const remainingCount = totalCount === null ? 0 : Math.max(0, totalCount - files.length);
  const activeFilterCount = countActiveFilters(querySpec.filters);
  const scopeText = libraryScopeLabel(legacyScope, t("allIndexedFiles"), t("noFolderSelected"));
  const isNoIndexState = !stats.lastScannedAt && legacyScope.kind === "all" && totalCount === 0 && !isLoading && !resultError;
  const showLibraryControls = !isNoIndexState;
  const sortOptions = useMemo(() => [
    { key: "modified" as const, label: t("librarySortModified") },
    { key: "created" as const, label: t("librarySortCreated") },
    { key: "name" as const, label: t("librarySortName") },
    { key: "size" as const, label: t("librarySortSize") },
    { key: "confidence" as const, label: t("librarySortConfidence") },
    { key: "relevance" as const, label: t("librarySortRelevance") }
  ], [t]);
  const currentSortLabel = sortOptions.find((option) => option.key === querySpec.sort.kind)?.label ?? t("librarySortModified");

  const closeContentUnderstanding = useCallback(() => {
    const restoreTarget = contentTriggerRef.current;
    contentRestoreTargetRef.current = restoreTarget;
    contentRefreshEpoch.current += 1;
    contentOpenEpoch.current += 1;
    pendingContentOpenRef.current = null;
    contentTriggerRef.current = null;
    contentDetailRef.current = null;
    setContentDetail(null);
    requestAnimationFrame(() => {
      restoreLibraryFocus(restoreTarget);
      requestAnimationFrame(() => {
        if (contentRestoreTargetRef.current === restoreTarget) contentRestoreTargetRef.current = null;
      });
    });
  }, []);

  useEffect(() => {
    contentDetailRef.current = contentDetail;
  }, [contentDetail]);

  useEffect(() => () => {
    contentRefreshEpoch.current += 1;
    contentDetailRef.current = null;
  }, []);

  useEffect(() => {
    void loadTags().catch(() => undefined);
    void loadSavedViews().catch(() => undefined);
  }, [loadSavedViews, loadTags]);

  useEffect(() => {
    if (!selection) {
      clearInspector();
    } else if (selectedIds.size === 1) {
      if (pendingContentOpenRef.current?.fileId !== selectedIdList[0]) void loadDetail(selectedIdList[0]);
    } else {
      void loadSelectionSummary(selection).catch(() => undefined);
    }
  }, [clearInspector, loadDetail, loadSelectionSummary, selectedIdList, selectedIds, selection]);

  useEffect(() => {
    if (contentDetail && (selectedIds.size !== 1 || contentDetail.id !== selectedIdList[0])) closeContentUnderstanding();
  }, [closeContentUnderstanding, contentDetail?.id, selectedIds]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnPointer = (event: globalThis.PointerEvent) => closeContextMenu("outside-pointer", event.target);
    const closeOnKey = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); closeContextMenu("escape"); } };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnKey);
    return () => { document.removeEventListener("pointerdown", closeOnPointer); document.removeEventListener("keydown", closeOnKey); };
  }, [contextMenu]);

  function closeFilterPopover() {
    setIsFilterOpen(false);
    requestAnimationFrame(() => filterButtonRef.current?.focus());
  }

  function closeSortPopover() {
    setIsSortOpen(false);
    requestAnimationFrame(() => sortButtonRef.current?.focus());
  }

  function chooseSort(kind: typeof querySpec.sort.kind) {
    setSort(kind);
    closeSortPopover();
  }

  function selectRow(event: MouseEvent<HTMLDivElement>, index: number) {
    const file = files[index];
    if (!file) return;
    const ids = files.map((item) => item.id);
    if (event.shiftKey) toggleSelection(file.id, ids, true);
    else if (event.metaKey || event.ctrlKey) toggleSelection(file.id, ids);
    else setExplicitSelection([file.id], file.id, index);
    closeContextMenu("action", null, false);
  }

  function selectAllLoaded() {
    setExplicitSelection(files.map((file) => file.id), files[0]?.id ?? "", files.length ? 0 : -1);
  }

  function focusList() {
    document.querySelector<HTMLElement>('[role="listbox"]')?.focus();
  }

  function restoreLibraryFocus(target: HTMLElement | null) {
    if (target && isValidFocusTarget(target)) {
      target.focus();
      if (document.activeElement === target) return;
    }
    focusList();
  }

  function closeContextMenu(reason: ContextMenuCloseReason = "action", pointerTarget: EventTarget | null = null, restoreFocus = reason !== "dialog-handoff") {
    const restoreTarget = contextMenu?.restoreFocusElement ?? null;
    setContextMenu(null);
    if (!restoreFocus) return;
    requestAnimationFrame(() => {
      if (reason === "outside-pointer") {
        const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        if (isValidFocusTarget(active)) return;
        const pointerElement = focusablePointerTarget(pointerTarget);
        if (pointerElement) {
          pointerElement.focus();
          if (document.activeElement === pointerElement) return;
        }
      }
      restoreLibraryFocus(restoreTarget);
    });
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const ids = files.map((file) => file.id);
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectAllLoaded();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (contextMenu) closeContextMenu("escape");
      else if (previewFile) closePreview();
      else clearSelection();
      return;
    }
    if (event.key === "ContextMenu" || (event.shiftKey && (event.key === "F10" || event.key === "ContextMenu"))) {
      event.preventDefault();
      const file = files.find((item) => item.id === focusedId) ?? files[0];
      if (file) openContextMenu(file);
      return;
    }
    const navigationKeys = ["ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
    if (navigationKeys.includes(event.key)) {
      event.preventDefault();
      if (!ids.length) return;
      const currentIndex = Math.max(0, ids.indexOf(focusedId));
      const step = event.key === "PageUp" ? -10 : event.key === "PageDown" ? 10 : event.key === "Home" ? -currentIndex : event.key === "End" ? ids.length : event.key === "ArrowUp" ? -1 : 1;
      const nextIndex = Math.max(0, Math.min(ids.length - 1, currentIndex + step));
      if (event.shiftKey) toggleSelection(ids[nextIndex], ids, true);
      else setExplicitSelection([ids[nextIndex]], ids[nextIndex], nextIndex);
      document.getElementById(`library-row-${ids[nextIndex]}`)?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (event.key === "Enter" || event.key === " " || event.key === "Space") {
      event.preventDefault();
      const file = files.find((item) => item.id === focusedId) ?? files[0];
      if (file) void openPreview(file, event.currentTarget).catch(() => undefined);
    }
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const file = files[index];
    if (!file) return;
    openContextMenu(file, event.clientX, event.clientY);
  }

  function openContextMenu(file: FileLibrarySummary, anchorX?: number, anchorY?: number) {
    const currentSelection = useFileLibrarySelectionStore.getState().selection;
    if (!selectionContainsFileId(currentSelection, file.id)) setExplicitSelection([file.id], file.id, files.findIndex((item) => item.id === file.id));
    const row = document.getElementById(`library-row-${file.id}`);
    const rect = row?.getBoundingClientRect();
    const list = document.querySelector<HTMLElement>('[role="listbox"]');
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInLibrary = active && list?.contains(active) && active !== document.body && active !== document.documentElement && (active === list || active.tabIndex >= 0 || active.matches("button, input, select, textarea, a[href], [contenteditable='true']"));
    const restoreFocusElement = activeInLibrary ? active : list?.isConnected ? list : row?.isConnected ? row : null;
    const width = 260;
    const height = 220;
    setContextMenu({ file, restoreFocusElement, x: Math.max(8, Math.min(anchorX ?? rect?.left ?? 8, window.innerWidth - width - 8)), y: Math.max(8, Math.min(anchorY ?? rect?.bottom ?? 8, window.innerHeight - height - 8)) });
  }

  function closePreview() {
    const restoreTarget = previewTriggerRef.current;
    const closeEpoch = previewOpenEpoch.current + 1;
    previewOpenEpoch.current = closeEpoch;
    previewTriggerRef.current = null;
    setPreviewFile(null);
    requestAnimationFrame(() => {
      if (previewOpenEpoch.current !== closeEpoch) return;
      requestAnimationFrame(() => {
        if (previewOpenEpoch.current !== closeEpoch) return;
        restoreLibraryFocus(restoreTarget);
      });
    });
  }

  async function openPreview(file: FileLibrarySummary | FileLibraryDetail, trigger: HTMLElement | null) {
    const openEpoch = previewOpenEpoch.current + 1;
    previewOpenEpoch.current = openEpoch;
    previewTriggerRef.current = trigger;
    if (contextMenu) closeContextMenu("dialog-handoff");
    try {
      const loaded = isFileLibraryDetail(file) ? file : await tauriApi.getFileLibraryDetail(file.id);
      if (previewOpenEpoch.current !== openEpoch) return;
      setPreviewFile(loaded);
    } catch (error) {
      if (previewOpenEpoch.current !== openEpoch) return;
      const restoreTarget = previewTriggerRef.current;
      previewTriggerRef.current = null;
      onError(readableError(error));
      requestAnimationFrame(() => restoreLibraryFocus(restoreTarget));
    }
  }

  async function revealFile(fileId: string) {
    try {
      await tauriApi.revealFileLibraryEntry(fileId);
    } catch (error) {
      onError(readableError(error));
    }
  }

  async function openOperationsPreview(targetFileIds?: ReadonlySet<string>) {
    const currentSelection = useFileLibrarySelectionStore.getState().selection;
    if (!targetFileIds && !currentSelection) {
      onError(t("libraryOperationPreviewRequiresSelection"));
      return;
    }
    clearExecutionIntent();
    try {
      const result = targetFileIds
        ? await refreshPreviewsForFiles(legacyScope, new Set(targetFileIds))
        : currentSelection?.kind === "all_matching"
          ? await refreshPreviewsForSelection(legacyScope, currentSelection)
          : await refreshPreviewsForFiles(legacyScope, new Set(selectedIdList));
      if (!result?.previews.length) {
        onError(t("libraryNoOperationsForSelection"));
        return;
      }
      setView("preview");
    } catch (error) {
      onError(readableError(error));
    }
  }

  function openPermanentDeletePreview(file: FileLibraryDetail) {
    if (capabilities?.permanentDeleteAvailable !== true || file.isStale) return;
    const preview: OperationPreview = {
      id: `permanent-delete-${file.id}`,
      fileId: file.id,
      file_id: file.id,
      operation_type: "permanent_delete",
      source_path: file.path,
      target_path: "Permanent deletion quarantine",
      old_name: file.name,
      new_name: file.name,
      status: "pending",
      risk_level: "Sensitive",
      confidence: 1,
      requires_confirmation: true,
      suggested_action: "DeleteCandidate",
      is_duplicate: file.isDuplicate,
      reason: t("libraryPermanentDeleteReason"),
      selected_by_default: true,
      is_executable: true,
      editable_new_name: false,
      target_parent_exists: true,
      will_create_parent: false,
      strategy: "backend_resolves_at_confirmation",
      conflict_policy: "permanent_delete_quarantine",
      will_copy: false,
      will_move: true,
      will_download: false,
      materialization_requirement: "none",
      will_replace: false,
      will_trash: false
    };
    clearExecutionIntent();
    setPreviewResult(
      { previews: [preview], total: 1, limit: 1, offset: 0, truncated: false, hasMore: false },
      legacyScope
    );
    setView("preview");
  }

  async function toggleTag(tagId: string, operation: "add" | "remove") {
    if (!selection) return;
    try {
      await mutateTags({ selection, tagIds: [tagId], operation, expectedCount: selectionSummary?.count ?? null });
      await refreshResults();
      if (selectedIds.size === 1) await loadDetail(selectedIdList[0]);
    } catch (error) {
      onError(readableError(error));
    }
  }

  function openContentUnderstanding(file: FileLibraryDetail, trigger?: HTMLElement) {
    contentRefreshEpoch.current += 1;
    contentOpenEpoch.current += 1;
    pendingContentOpenRef.current = null;
    contentRestoreTargetRef.current = null;
    contentTriggerRef.current = trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    contentDetailRef.current = file;
    setContentDetail(file);
  }

  function ownsSingleFileSelection(fileId: string) {
    const current = useFileLibrarySelectionStore.getState().selection;
    return current?.kind === "explicit" && current.fileIds.length === 1 && current.fileIds[0] === fileId;
  }

  async function openContentForFile(fileId: string, trigger?: HTMLElement, providedDetail?: FileLibraryDetail) {
    const fileIndex = files.findIndex((file) => file.id === fileId);
    const operationEpoch = contentOpenEpoch.current + 1;
    contentOpenEpoch.current = operationEpoch;
    if (!ownsSingleFileSelection(fileId)) {
      pendingContentOpenRef.current = { epoch: operationEpoch, fileId };
      setExplicitSelection([fileId], fileId, fileIndex);
    }
    if (!ownsSingleFileSelection(fileId)) return;
    const inspector = useFileLibraryInspectorStore.getState();
    if (providedDetail?.id === fileId) {
      openContentUnderstanding(providedDetail, trigger);
      return;
    }
    if (!inspector.isLoading && inspector.selectedId === fileId && inspector.detail?.id === fileId) {
      openContentUnderstanding(inspector.detail, trigger);
      return;
    }
    pendingContentOpenRef.current = { epoch: operationEpoch, fileId };
    try {
      const outcome: InspectorDetailLoadResult = await loadDetail(fileId);
      if (pendingContentOpenRef.current?.epoch !== operationEpoch || !ownsSingleFileSelection(fileId)) return;
      if (outcome.status === "superseded") return;
      if (outcome.status === "failed") {
        onError(t("contentOpenFailed"));
        restoreLibraryFocus(trigger ?? null);
        return;
      }
      const current = useFileLibraryInspectorStore.getState();
      if (current.selectedId !== fileId || current.detail?.id !== fileId) return;
      openContentUnderstanding(outcome.detail, trigger);
    } catch (error) {
      if (pendingContentOpenRef.current?.epoch === operationEpoch) {
        onError(t("contentOpenFailed"));
        restoreLibraryFocus(trigger ?? null);
      }
    } finally {
      if (pendingContentOpenRef.current?.epoch === operationEpoch) pendingContentOpenRef.current = null;
    }
  }

  const refreshContentDetail = useCallback(async (fileId: string): Promise<ContentRefreshResult> => {
    const refreshEpoch = contentRefreshEpoch.current + 1;
    contentRefreshEpoch.current = refreshEpoch;
    const ownsRefresh = () => refreshEpoch === contentRefreshEpoch.current && contentDetailRef.current?.id === fileId;
    const inspectorAtStart = useFileLibraryInspectorStore.getState();
    const expectedInspectorEpoch = inspectorAtStart.requestEpoch;
    const inspectorOwnedFile = inspectorAtStart.selectedId === fileId;
    try {
      const refreshed = await tauriApi.getFileLibraryDetail(fileId);
      if (!ownsRefresh()) return { status: "superseded" as const };
      const policy = refreshed.scanRootId
        ? await tauriApi.getContentScopePolicy(refreshed.scanRootId)
        : null;
      if (!ownsRefresh()) return { status: "superseded" as const };
      contentDetailRef.current = refreshed;
      setContentDetail(refreshed);
      const currentInspector = useFileLibraryInspectorStore.getState();
      if (inspectorOwnedFile
        && currentInspector.requestEpoch === expectedInspectorEpoch
        && currentInspector.selectedId === fileId) commitDetailIfCurrent(fileId, refreshed, expectedInspectorEpoch);
      return { status: "applied" as const, detail: refreshed, policy };
    } catch (error) {
      if (!ownsRefresh()) return { status: "superseded" as const };
      onError(t("contentOpenFailed"));
      return { status: "failed" as const, error };
    }
  }, [commitDetailIfCurrent, onError, t]);
  const refreshOpenContentDetail = useCallback(
    () => contentDetailRef.current
      ? refreshContentDetail(contentDetailRef.current.id)
      : Promise.resolve({ status: "superseded" as const }),
    [refreshContentDetail]
  );

  async function openContentFromContext(fileId: string) {
    const context = contextMenu;
    closeContextMenu("dialog-handoff");
    await openContentForFile(fileId, context?.restoreFocusElement ?? undefined);
  }

  function libraryState() {
    if (resultState === "snapshot_expired" || resultError === "library_snapshot_expired") return null;
    if (resultError || resultState === "failed") return { tone: "error" as const, title: t("libraryLoadFailedTitle"), description: resultError ?? t("libraryLoadFailedDesc"), primaryAction: <button className={buttonSecondary} onClick={() => void refreshResults().catch(() => undefined)}>{t("libraryRetry")}</button> };
    if (isLoading && totalCount === 0) return { tone: "info" as const, title: t("libraryLoadingResults"), description: t("libraryScopeHint") };
    if (isNoIndexState) return { tone: "info" as const, title: t("libraryNoScanTitle"), description: t("libraryNoScanDesc"), primaryAction: <button className={glassButtonPrimary} onClick={() => setView("scanner")}><Layers size={16} />{t("libraryGoToOverview")}</button> };
    if (isEmptyCurrentScanScope) return { tone: "info" as const, title: t("noCurrentScanTitle"), description: t("noCurrentScanDesc"), primaryAction: <button className={glassButtonPrimary} onClick={() => setView("scanner")}><Layers size={16} />{t("libraryGoToOverview")}</button>, secondaryAction: <button className={buttonSecondary} onClick={() => setLegacyScope({ kind: "all" })}>{t("viewAllIndexedFiles")}</button> };
    if (totalCount !== null && totalCount > 0) return null;
    if (librarySearch.trim()) return { tone: "neutral" as const, title: t("libraryNoSearchTitle"), description: t("libraryNoSearchDesc") };
    if (activeFilterCount) return { tone: "neutral" as const, title: t("libraryNoFilterTitle"), description: t("libraryNoFilterDesc") };
    return { tone: "neutral" as const, title: t("libraryNoScopeFilesTitle"), description: t("libraryNoScopeFilesDesc"), secondaryAction: <button className={buttonSecondary} onClick={() => setLegacyScope({ kind: "all" })}>{t("viewAllIndexedFiles")}</button> };
  }

  const state = libraryState();
  const selectionLabel = selection?.kind === "all_matching"
    ? replaceCopy(t("librarySelectionAll"), { count: totalCount === null ? t("libraryCountPending") : totalCount.toLocaleString(), excluded: selection.excludedFileIds.length.toLocaleString() })
    : selectedIds.size ? replaceCopy(t("librarySelectionLoaded"), { count: selectedIds.size.toLocaleString() }) : t("librarySelectionNone");
  const resultCountLabel = isLoading
    ? t("loading")
    : isCountLoading || totalCount === null
      ? replaceCopy(t("libraryResultCountDeferred"), { loaded: files.length.toLocaleString() })
      : replaceCopy(t("libraryResultCountExact"), { loaded: files.length.toLocaleString(), total: totalCount.toLocaleString() });

  return (
    <div className={cn(pageFrame, "gap-3 overflow-x-hidden")}>
      <section className={cn(raisedSurface, "relative z-20 grid shrink-0 gap-2 px-3 py-2")}>
        <div data-section="scope bar" className="flex min-w-0 flex-wrap items-center justify-between gap-2" aria-label={scopeText}><span className="truncate text-xs text-[var(--zc-text-secondary)]">{scopeText}{scopeHealth && scopeHealth.state !== "healthy" ? ` · ${scopeHealthLabel(scopeHealth.state, t)}` : ""}</span><div className="flex flex-wrap items-center gap-2">{legacyScope.kind !== "all" && !isEmptyCurrentScanScope ? <button className={cn(buttonGhost, "min-h-8 px-2.5 py-1.5 text-xs")} onClick={() => setLegacyScope({ kind: "all" })}><Layers size={15} />{t("viewAllIndexedFiles")}</button> : null}<button className={cn(buttonGhost, "min-h-8 px-2.5 py-1.5 text-xs")} onClick={() => void handleChooseFolders().catch(() => undefined)}><FolderSearch size={15} />{t("switchScanDirectory")}</button></div></div>
        {showLibraryControls ? <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div data-section="search bar" className="min-w-[min(100%,320px)] flex-1"><SearchField value={librarySearch} onChange={(event) => handleLibrarySearchChange(event.currentTarget.value)} onClear={() => handleLibrarySearchChange("")} label={t("librarySearchLabel")} clearLabel={t("librarySearchClear")} placeholder={legacyScope.kind === "all" ? t("librarySearchPlaceholder") : t("librarySearchPlaceholderScoped")} className="min-w-0" /></div>
          <div className="relative" data-section="filter toolbar"><button ref={filterButtonRef} className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} aria-expanded={isFilterOpen} aria-controls="library-filter-popover" aria-haspopup="dialog" onClick={() => { setIsFilterOpen((value) => !value); setIsSortOpen(false); }}><SlidersHorizontal size={15} />{t("libraryFilterButton")}{activeFilterCount ? <span className="tabular-nums text-[var(--zc-primary)]">{activeFilterCount}</span> : null}</button>{isFilterOpen ? <div id="library-filter-popover"><FileLibraryFilterPopover filters={querySpec.filters} tags={tags} t={t} onFiltersChange={updateFilters} onClear={clearFilters} onClose={closeFilterPopover} /></div> : null}</div>
          <div className="relative"><button ref={sortButtonRef} className={cn(buttonSubtle, "min-h-9 px-3 py-1.5 text-xs")} aria-expanded={isSortOpen} aria-haspopup="menu" onClick={() => { setIsSortOpen((value) => !value); setIsFilterOpen(false); }}><span>{currentSortLabel}</span><ChevronDown size={14} /></button>{isSortOpen ? <div className="absolute right-0 top-[calc(100%+8px)] z-30 grid min-w-48 rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-2 shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" role="menu" aria-label={t("librarySortMenuLabel")}><div className="grid gap-1">{sortOptions.map((option) => <button key={option.key} role="menuitemradio" aria-checked={querySpec.sort.kind === option.key} className={cn("flex min-h-9 items-center justify-between rounded-[var(--zc-radius-control)] px-3 text-left text-sm", querySpec.sort.kind === option.key ? "bg-[var(--zc-surface-selected)] text-[var(--zc-text-primary)]" : "text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)]")} onClick={() => chooseSort(option.key)}>{option.label}<span className="text-xs">{querySpec.sort.kind === option.key ? querySpec.sort.direction === "desc" ? "↓" : "↑" : ""}</span></button>)}</div></div> : null}</div>
          <select className={cn(buttonSubtle, "min-h-9 max-w-48 px-2 text-xs")} value={activeViewId ?? ""} onChange={(event) => applySavedView(savedViews.find((view) => view.id === event.target.value) ?? null)} aria-label={t("librarySavedViewsLabel")}><option value="">{t("librarySavedViewsPlaceholder")}</option>{savedViews.map((view) => <option key={view.id} value={view.id}>{view.displayName}{view.invalidReferences.length ? ` · ${t("librarySavedViewInvalid")}` : ""}</option>)}</select>
        </div> : null}
        {showLibraryControls ? <div className="flex flex-wrap items-center gap-2" data-section="saved views and tags"><button data-library-manager="saved_views" className={cn(buttonSubtle, "min-h-8 px-2 text-xs")} onClick={() => setMetadataManager("saved_views")}><Bookmark size={14} />{t("libraryManageSavedViews")}</button><button data-library-manager="tags" className={cn(buttonSubtle, "min-h-8 px-2 text-xs")} onClick={() => setMetadataManager("tags")}><Tag size={14} />{t("libraryManageTags")}{tags.length ? ` · ${tags.length}` : ""}</button></div> : null}
        {showLibraryControls ? <div data-section="applied filters" className="flex min-h-0 flex-wrap items-center gap-1.5" aria-label={t("libraryAppliedFilters")}><span className="text-xs text-[var(--zc-text-tertiary)]">{activeFilterCount ? replaceCopy(t("libraryFiltersAppliedCount"), { count: activeFilterCount }) : t("libraryFilterAllOptions")}</span>{activeFilterCount ? <button className="text-xs text-[var(--zc-primary)] underline" onClick={clearFilters}>{t("libraryFilterClear")}</button> : null}</div> : null}
        {showLibraryControls ? <MetricStrip ariaLabel={t("libraryMetricsLabel")} density="compact" items={[{ label: t("libraryResultCountLabel"), value: resultCountLabel }, { label: t("librarySelectionLabel"), value: selectionLabel }]} /> : null}
        {showLibraryControls && selection?.kind === "explicit" && selectedIds.size === files.length && totalCount !== null && totalCount > files.length ? <button className="justify-self-start text-xs text-[var(--zc-primary)] underline" onClick={selectAllMatching}>{t("librarySelectAllMatching")}</button> : null}
      </section>

      <DuplicateGroupsPanel />
      {resultState === "snapshot_expired" || resultError === "library_snapshot_expired" ? (
        <NoticeBanner
          tone="warning"
          title={t("librarySnapshotExpiredTitle")}
          action={<button className={buttonSecondary} onClick={() => void refreshResults().catch(() => undefined)}>{t("librarySnapshotRefresh")}</button>}
        >
          {t("librarySnapshotExpiredDesc")}
        </NoticeBanner>
      ) : null}
      <InspectorLayout
        className={showInspectorLayout(isNoIndexState)}
        main={<section className={cn(raisedSurface, "min-h-0 overflow-hidden max-[1100px]:min-h-[340px]")} aria-label={t("fileLibrary")}>{state ? <StateBlock tone={state.tone} title={state.title} description={state.description} primaryAction={state.primaryAction} secondaryAction={state.secondaryAction} /> : <FileLibraryList files={files} selectedIds={selectedIds} focusedId={focusedId} hasMore={hasMore} isLoading={isLoading} remainingCount={remainingCount} language={language} t={t} onKeyDown={handleListKeyDown} onRowClick={selectRow} onRowDoubleClick={(event, index) => { event.preventDefault(); const file = files[index]; if (file) void openPreview(file, event.currentTarget).catch(() => undefined); }} onRowContextMenu={handleContextMenu} onLoadMore={() => void loadNextPage().catch(() => undefined)} />}</section>}
        inspector={!isNoIndexState ? <FileLibraryInspector selectedIds={selectedIds} selectedFiles={selectedFiles} detail={detail} selectionSummary={selectionSummary} isLoading={isInspectorLoading} error={inspectorError} language={language} t={t} onPreview={(event, file) => void openPreview(file, event.currentTarget).catch(() => undefined)} onReveal={(fileId) => void revealFile(fileId).catch(() => undefined)} onViewSuggestions={() => setView("organize")} onViewOperations={() => void openOperationsPreview().catch(() => undefined)} onPermanentDelete={capabilities?.permanentDeleteAvailable === true ? openPermanentDeletePreview : undefined} onOpenContentUnderstanding={(file, trigger) => void openContentForFile(file.id, trigger, file)} onClearSelection={clearSelection} onRetryDetail={() => { if (selectedIds.size === 1) void loadDetail(selectedIdList[0]); }} availableTags={tags} onToggleTag={(tagId, operation) => void toggleTag(tagId, operation).catch(() => undefined)} /> : undefined}
        inspectorLabel={t("libraryInspector")}
      />
      <p className="sr-only" aria-live="polite" aria-atomic="true">{selectionLabel}</p>
      {contextMenu ? <LibraryContextMenu context={contextMenu} t={t} onClose={() => closeContextMenu("action")} onPreview={(trigger) => void openPreview(contextMenu.file, trigger).catch(() => undefined)} onReveal={() => void revealFile(contextMenu.file.id).catch(() => undefined)} onOpenContent={() => void openContentFromContext(contextMenu.file.id).catch(() => undefined)} onViewOperations={() => void openOperationsPreview(new Set([contextMenu.file.id])).catch(() => undefined)} onViewSuggestions={() => setView("organize")} onClearSelection={clearSelection} /> : null}
      <FileLibraryPreviewDialog file={previewFile} language={language} t={t} restoreFocus={() => previewTriggerRef.current} onClose={closePreview} onReveal={(fileId) => void revealFile(fileId).catch(() => undefined)} />
      {contentDetail ? <ContentUnderstandingSheet open detail={contentDetail} t={t} restoreFocus={() => contentRestoreTargetRef.current ?? contentTriggerRef.current} onClose={closeContentUnderstanding} onRefreshAuthoritativeContentState={refreshOpenContentDetail} /> : null}
      <LibraryMetadataManagerDialog
        kind={metadataManager}
        query={cloneFileQuerySpec({ ...querySpec, text: debouncedSearchQuery.trim() || null })}
        selection={selection}
        selectionCount={selectionSummary?.count ?? (selection?.kind === "all_matching" ? totalCount : selectedIds.size)}
        activeViewId={activeViewId}
        t={t}
        onApplyView={(view) => { applySavedView(view); setMetadataManager(null); }}
        onMutated={async () => {
          await refreshResults();
          if (selectedIds.size === 1) await loadDetail(selectedIdList[0]);
          else if (selection) await loadSelectionSummary(selection);
        }}
        onClose={() => setMetadataManager(null)}
      />
    </div>
  );
}

function countActiveFilters(filters: FileQueryFiltersV2) {
  return filters.fileTypes.length + filters.purposes.length + filters.lifecycles.length + filters.risks.length + filters.tagsAllOf.length + filters.tagsAnyOf.length + filters.tagsNoneOf.length + Number(filters.sizeMin !== null || filters.sizeMax !== null) + Number(filters.modifiedFrom !== null || filters.modifiedTo !== null) + Number(filters.createdFrom !== null || filters.createdTo !== null) + Number(filters.duplicate !== "any") + Number(filters.review !== "any");
}

function showInspectorLayout(noIndex: boolean) {
  return noIndex ? "max-[1100px]:grid-cols-1" : "";
}

function isFileLibraryDetail(file: FileLibrarySummary | FileLibraryDetail): file is FileLibraryDetail {
  return "path" in file;
}

function isValidFocusTarget(target: HTMLElement | null) {
  return Boolean(target?.isConnected
    && target !== document.body
    && target !== document.documentElement
    && (target.tabIndex >= 0 || target.matches("button, input, select, textarea, a[href], [contenteditable='true']")));
}

function focusablePointerTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (isValidFocusTarget(element)) return element;
  const closest = element?.closest<HTMLElement>("button, input, select, textarea, a[href], [contenteditable='true']") ?? null;
  return isValidFocusTarget(closest) ? closest : null;
}

function replaceCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((copy, [key, value]) => copy.replaceAll(`{${key}}`, String(value)), template);
}

function scopeHealthLabel(state: string, t: ReturnType<typeof import("../../i18n").makeTranslator>) {
  if (state === "permission_required") return t("libraryScopeHealthPermission");
  if (state === "reconciliation_required") return t("libraryScopeHealthReconciliation");
  if (state === "partial" || state === "degraded") return t("libraryScopeHealthPartial");
  if (state === "retry_exhausted") return t("libraryScopeHealthRetry");
  return t("libraryScopeHealthUnavailable");
}

function LibraryContextMenu({ context, t, onClose, onPreview, onReveal, onOpenContent, onViewOperations, onViewSuggestions, onClearSelection }: { context: ContextMenuState; t: ReturnType<typeof import("../../i18n").makeTranslator>; onClose: () => void; onPreview: (trigger: HTMLElement | null) => void; onReveal: () => void; onOpenContent: () => void; onViewOperations: () => void; onViewSuggestions: () => void; onClearSelection: () => void }) {
  const itemRefs = useRef<HTMLButtonElement[]>([]);
  const items: Array<{ label: string; action: (trigger: HTMLElement | null) => void }> = [
    { label: t("libraryPreview"), action: onPreview },
    { label: libraryRevealLabel(t), action: () => { onReveal(); onClose(); } },
    { label: t("contentOpen"), action: () => onOpenContent() },
    { label: t("libraryReviewOperations"), action: () => { onViewOperations(); onClose(); } },
    { label: t("libraryViewSuggestions"), action: () => { onViewSuggestions(); onClose(); } },
    { label: t("libraryClearSelection"), action: () => { onClearSelection(); onClose(); } }
  ];
  useEffect(() => { itemRefs.current[0]?.focus(); }, []);
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusable = itemRefs.current.filter(Boolean);
    const activeIndex = focusable.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) { event.preventDefault(); if (!focusable.length) return; const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? focusable.length - 1 : event.key === "ArrowDown" ? (activeIndex + 1 + focusable.length) % focusable.length : (activeIndex - 1 + focusable.length) % focusable.length; focusable[nextIndex]?.focus(); return; }
    if (event.key === "Tab") { event.preventDefault(); if (focusable.length) focusable[(activeIndex + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length]?.focus(); return; }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (activeIndex >= 0) items[activeIndex]?.action(focusable[activeIndex] ?? null); }
  }
  return <div className="fixed z-50 grid max-h-screen min-w-52 gap-1 overflow-y-auto overscroll-contain rounded-[var(--zc-radius-floating)] border border-[var(--zc-border-strong)] bg-[var(--zc-surface-floating)] p-2 shadow-[var(--zc-shadow-floating)] backdrop-blur-xl" style={{ left: context.x, top: context.y }} role="menu" aria-label={t("libraryContextMenu")} tabIndex={-1} onKeyDown={handleKeyDown} onPointerDown={(event) => event.stopPropagation()}><p className="truncate px-3 py-1 text-xs font-semibold text-[var(--zc-text-tertiary)]" title={context.file.name}>{context.file.name}</p>{items.map((item, index) => <button key={item.label} ref={(element) => { if (element) itemRefs.current[index] = element; }} type="button" role="menuitem" className="flex min-h-9 items-center rounded-[var(--zc-radius-control)] px-3 text-left text-sm text-[var(--zc-text-secondary)] hover:bg-[var(--zc-surface-hover)] hover:text-[var(--zc-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--zc-focus-ring)]" onClick={(event) => item.action(event.currentTarget)}>{item.label}</button>)}</div>;
}
